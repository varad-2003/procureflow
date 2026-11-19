import { evaluatePolicy } from '../policy/evaluator.js';
import { resolveItem } from './matching.js';
import { groupRequirements } from './grouping.js';
import { applicableContracts, chooseContract } from './contracts.js';
import { preferredSuppliers, suggestSuppliers } from './suppliers.js';

export function processBatch({ lines, items, suppliers, history, contracts, policy, policyResolver }) {
  contracts = (contracts || []).map((contract) => ({
    ...contract,
    lines: (contract.lines || []).map((line) => ({ ...line })),
    consumedValue: Number(contract.consumedValue || 0)
  }));
  const enriched = lines.map((line) => {
    const match = resolveItem(line, items);
    return { ...line, resolvedItemCode: match.item.itemCode, resolvedItem: match.item, matchConfidence: match.confidence };
  });
  const groups = groupRequirements(enriched);
  const decisions = groups.map((group) => {
    const first = group.lines[0], item = first.resolvedItem;
    const quantity = group.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const candidates = item.itemCode === 'NEW' ? [] : applicableContracts(contracts, item.itemCode, first.createdAt, suppliers);
    const usable = item.itemType !== 'Capex' ? chooseContract(candidates, quantity) : null;
    const fallbackContract = candidates.sort((a, b) => a.line.rate - b.line.rate)[0];
    let rate = 0;
    if (item.itemCode === 'NEW') {
      rate = Number(first.estimatedUnitPrice) > 0 ? Number(first.estimatedUnitPrice) : 0;
    } else if (usable) {
      rate = usable.line.rate;
    } else if (fallbackContract) {
      rate = fallbackContract.line.rate;
    } else {
      const cutoff = new Date(new Date(first.createdAt).getTime() - 365 * 86400000);
      const recentPos = history
        .filter((row) => row.itemCode === item.itemCode && new Date(row.poDate) <= new Date(first.createdAt) && new Date(row.poDate) >= cutoff)
        .sort((a, b) => new Date(b.poDate) - new Date(a.poDate) || String(b.poNumber || '').localeCompare(String(a.poNumber || ''), undefined, { numeric: true }));
      rate = recentPos[0]?.unitPrice ?? item.standardPrice ?? 0;
    }
    const value = quantity * rate;
    const preferred = item.itemCode === 'NEW' ? [] : preferredSuppliers(item.itemCode, first.createdAt, suppliers, history, contracts);
    const recentActiveSupplierPurchase = preferred.some((entry) => history.some((row) => row.itemCode === item.itemCode && row.supplierId === entry.supplier.supplierId && new Date(row.poDate) <= new Date(first.createdAt) && new Date(row.poDate) >= new Date(new Date(first.createdAt).getTime() - 365 * 86400000)));
    const policyContext = { itemType: item.itemType, itemCategory: item.category, plant: first.plant, value, quantity, emergency: group.lines.some((line) => String(line.urgency).toLowerCase() === 'emergency'), contractUsable: Boolean(usable), recentActiveSupplierPurchase };
    const effectivePolicy = policyResolver ? policyResolver(first.createdAt) : policy;
    const outcome = item.itemCode === 'NEW' ? { decision: 'SOURCING_REQUEST', route: 'NEW_ITEM_SOURCING', suggestions: 0, clause: '1.2', policyVersion: effectivePolicy.version } : evaluatePolicy(effectivePolicy, policyContext);
    const supplier = outcome.useContract ? usable.contract.supplierId : outcome.usePreferred ? preferred[0]?.supplier.supplierId : undefined;
    const suggestionCount = outcome.suggestions || 0;
    const suggestions = item.itemCode === 'NEW' ? [] : suggestSuppliers(item.itemCode, item.category, first.createdAt, suppliers, history, contracts, suggestionCount);
    if (outcome.useContract && usable) {
      usable.contract.consumedValue = (usable.contract.consumedValue || 0) + value;
    }
    return { groupId: group.groupId, lines: group.lines, plant: first.plant, requirementDate: first.createdAt, resolvedItemCode: item.itemCode, quantity, groupValueInr: value, unitPrice: rate, decision: outcome.decision, route: outcome.route, supplierId: supplier, suggestedSupplierIds: suggestions.map((entry) => entry.supplier.supplierId), policyVersion: effectivePolicy.version, clause: outcome.clause, reason: `Applied policy clause ${outcome.clause} to value ${value.toFixed(2)} and item ${item.itemCode}.`, contractId: usable?.contract.contractId };
  });
  const openPos = [];
  for (const decision of decisions.filter((entry) => entry.decision === 'PO').sort((a, b) => new Date(a.requirementDate) - new Date(b.requirementDate))) {
    const existing = openPos.find((po) => po.supplierId === decision.supplierId && po.plant === decision.plant &&
      po.route === decision.route && (new Date(decision.requirementDate) - new Date(po.firstDate)) <= 86400000);
    if (existing) { existing.decisions.push(decision); existing.value += decision.groupValueInr; decision.poId = existing.poId; }
    else { const po = { poId: `PO-${String(openPos.length + 1).padStart(6, '0')}`, supplierId: decision.supplierId, plant: decision.plant, route: decision.route, firstDate: decision.requirementDate, value: decision.groupValueInr, decisions: [decision] }; openPos.push(po); decision.poId = po.poId; }
  }
  return { groups, decisions };
}
