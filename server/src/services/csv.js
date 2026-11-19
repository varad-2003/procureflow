import Papa from 'papaparse';
export function parseCsv(text) { const result = Papa.parse(text, { header: true, skipEmptyLines: true }); if (result.errors.length) throw new Error(result.errors[0].message); return result.data; }
export function decisionsCsv(decisions) {
  const rows = decisions.flatMap((decision) => decision.lines.map((line) => ({ pr_no: line.prNo, pr_line: line.prLine, resolved_item_code: decision.resolvedItemCode, group_id: decision.groupId, po_id: decision.poId || '', decision: decision.decision, route: decision.route, supplier_id: decision.supplierId || '', unit_price: Number(decision.unitPrice.toFixed(2)), group_value_inr: Number(decision.groupValueInr.toFixed(2)), suggested_supplier_ids: decision.suggestedSupplierIds.join(';'), policy_version: decision.policyVersion, reason: decision.reason })));
  return Papa.unparse(rows);
}
