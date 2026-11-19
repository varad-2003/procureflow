import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy } from '../src/services/policy/evaluator.js';
import { policyV5 } from '../src/services/policy/defaultPolicy.js';
import { groupRequirements } from '../src/services/procurement/grouping.js';

test('policy priority selects contract before emergency and thresholds', () => {
  const result = evaluatePolicy(policyV5, { itemType: 'Material', contractUsable: true, emergency: true, value: 100000, recentActiveSupplierPurchase: true });
  assert.equal(result.route, 'CONTRACT_PO');
});
test('threshold boundary at one million is RFP', () => {
  assert.equal(evaluatePolicy(policyV5, { itemType: 'Material', contractUsable: false, value: 1000000 }).route, 'RFP');
});
test('new items are never grouped', () => {
  const groups = groupRequirements([{ resolvedItemCode: 'NEW', plant: 'PUN1', createdAt: '2026-01-01', needByDate: '2026-01-10', prNo: '1', prLine: 1 }, { resolvedItemCode: 'NEW', plant: 'PUN1', createdAt: '2026-01-02', needByDate: '2026-01-10', prNo: '2', prLine: 1 }]);
  assert.equal(groups.length, 2);
});
