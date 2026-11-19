import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import pdf from 'pdf-parse';
import { parseCsv } from '../src/services/csv.js';
import { policyV5 } from '../src/services/policy/defaultPolicy.js';
import { processBatch } from '../src/services/procurement/engine.js';
import { preferredSuppliers } from '../src/services/procurement/suppliers.js';
import { parseContractPdfText } from '../src/services/contracts/pdfContract.js';

const root = '../Cantill_FullStack_Task_Kit/';

async function loadSource() {
  const csv = async (path) => parseCsv(await readFile(root + path, 'utf8'));
  const items = (await csv('master_data/item_master.csv')).map((r) => ({
    itemCode: r.item_code, description: r.description, category: r.category,
    itemType: r.item_type, standardPrice: Number(r.standard_price)
  }));
  const suppliers = (await csv('master_data/supplier_master.csv')).map((r) => ({
    supplierId: r.supplier_id, name: r.name,
    categories: String(r.categories || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean),
    status: r.status, onTimePct: Number(r.on_time_pct), qualityRating: Number(r.quality_rating)
  }));
  const history = (await csv('master_data/po_history.csv')).map((r) => ({
    poNumber: r.po_number, poDate: r.po_date, supplierId: r.supplier_id,
    itemCode: r.item_code, quantity: Number(r.quantity), unitPrice: Number(r.unit_price),
    plant: r.plant
  }));
  const contracts = (await csv('contracts/contract_register.csv')).map((r) => ({
    contractId: r.contract_id, supplierId: r.supplier_id, supplierName: r.supplier_name,
    startDate: r.start_date, endDate: r.end_date, valueCap: Number(r.value_cap),
    consumedValue: Number(r.consumed_value), source: 'register', lines: []
  }));
  for (const r of await csv('contracts/contract_lines.csv')) {
    const contract = contracts.find((candidate) => candidate.contractId === r.contract_id);
    if (contract) contract.lines.push({
      itemCode: r.item_code, description: r.description, uom: r.uom, rate: Number(r.rate)
    });
  }
  for (const filename of await readdir(root + 'contracts/pdf')) {
    if (!filename.endsWith('.pdf')) continue;
    const buffer = await readFile(root + 'contracts/pdf/' + filename);
    const text = await pdf(buffer);
    const contract = parseContractPdfText(text.text, filename);
    if (!contracts.some((candidate) => candidate.contractId === contract.contractId) && contract.lines.length) {
      contracts.push(contract);
    }
  }
  const pr = (await csv('pr_batches/sample_pr_batch.csv')).map((r) => ({
    prNo: r.pr_no, prLine: Number(r.pr_line), createdAt: r.created_at, needByDate: r.need_by_date,
    plant: r.plant, itemCode: r.item_code || undefined, description: r.description,
    quantity: Number(r.quantity), estimatedUnitPrice: r.estimated_unit_price ? Number(r.estimated_unit_price) : undefined,
    urgency: r.urgency
  }));
  return { items, suppliers, history, contracts, pr };
}

function cents(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function runWorkedExample(number) {
  const source = await loadSource();
  const lineSets = {
    1: ['00019'], 2: ['00045'], 3: ['00004', '00026'], 4: ['00034', '00032'],
    5: ['00146', '00144', '00145'], 6: ['00106', '00103'], 7: ['00088'], 8: ['00059'],
    9: ['00089'], 10: ['00050'], 11: ['00100'], 12: ['00047'], 13: ['00170'],
    14: ['00031', '00035', '00034', '00032']
  };
  const expected = {
    1: { route: 'CONTRACT_PO', supplier: 'S001', value: 137531 },
    2: { route: 'CONTRACT_PO', supplier: 'S021', value: 26829 },
    3: { route: 'RFQ', supplier: null, value: 220256, lineCount: 2 },
    4: { route: 'CONTRACT_PO', supplier: 'S007', value: 32547 },
    5: { route: 'SPOT_PO', supplier: 'S024', value: 126472, lineCount: 3 },
    6: { route: 'SPOT_PO', supplier: 'S027', value: 156170 },
    7: { route: 'SPOT_PO', supplier: 'S023', value: 97955 },
    8: { route: 'EMERGENCY_PO', supplier: 'S014', value: 253184 },
    9: { route: 'RFQ', supplier: null, value: 336562, suggestions: ['S043', 'S044', 'S042'] },
    10: { route: 'RFQ', supplier: null, value: 80300, suggestions: ['S003', 'S002', 'S005'] },
    11: { route: 'RFP', supplier: null, value: 2070780, suggestions: ['S020', 'S017', 'S019', 'S018'] },
    12: { route: 'CAPEX_SOURCING', supplier: null, value: 6036704, suggestions: ['S045', 'S047', 'S020', 'S048', 'S046'] },
    13: { route: 'NEW_ITEM_SOURCING', supplier: null, value: 141100 },
    14: { route: 'CONTRACT_PO', supplier: 'S007', value: 32547 }
  };

  const lines = source.pr.filter((line) => lineSets[number].some((suffix) => line.prNo.endsWith(suffix)));
  const result = processBatch({ ...source, lines, policy: policyV5 });
  const want = expected[number];
  const primary = result.decisions[0];
  assert.equal(primary.route, want.route, `example ${number} route`);
  assert.equal(primary.supplierId || null, want.supplier, `example ${number} supplier`);
  let value;
  if (number === 6) {
    const pun = result.decisions.find((decision) => decision.lines.some((line) => line.plant === 'PUN1'));
    value = cents(pun?.groupValueInr || 0);
  } else if (number === 14) {
    value = cents(primary.groupValueInr);
  } else {
    value = cents(result.decisions.reduce((sum, decision) => sum + decision.groupValueInr, 0));
  }
  assert.ok(Math.abs(value - want.value) <= 2, `example ${number} value expected ${want.value}, actual ${value}`);
  if (want.lineCount) assert.equal(lines.length, want.lineCount, `example ${number} group line count`);
  if (want.suggestions) assert.deepEqual(primary.suggestedSupplierIds, want.suggestions, `example ${number} suggestions`);

  if (number === 14) {
    const split = processBatch({
      ...source,
      lines: source.pr.filter((line) => ['00031', '00035', '00034', '00032'].some((suffix) => line.prNo.endsWith(suffix))),
      policy: policyV5
    });
    assert.equal(new Set(split.decisions.map((decision) => decision.poId).filter(Boolean)).size, 1, 'worked example 14 same PO');
  }
  if (number === 6) {
    assert.equal(new Set(result.decisions.map((decision) => decision.poId).filter(Boolean)).size, 2, 'worked example 6 separate plants separate POs');
  }
}

for (let number = 1; number <= 14; number += 1) {
  test(`worked example ${number}`, async () => runWorkedExample(number));
}

test('three preferred supplier examples', async () => {
  const source = await loadSource();
  const cases = [
    ['ITM-1048', ['S029', 'S030']],
    ['ITM-1036', ['S023', 'S022', 'S024']],
    ['ITM-1016', ['S009', 'S010']]
  ];
  for (const [itemCode, order] of cases) {
    const ranked = preferredSuppliers(itemCode, '2026-11-01', source.suppliers, source.history, source.contracts);
    assert.deepEqual(ranked.slice(0, order.length).map((entry) => entry.supplier.supplierId), order);
  }
});
