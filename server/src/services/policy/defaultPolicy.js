export const policyV5 = {
  policyId: 'CORVO-PROCUREMENT', version: '5.0', effectiveDate: '2026-04-01', status: 'ACTIVE',
  rules: [
    { id: '5.1', priority: 10, clause: '5.1', when: { op: 'eq', field: 'itemType', value: 'Capex' }, outcome: { decision: 'SOURCING_REQUEST', route: 'CAPEX_SOURCING', suggestions: 5, capexApproval: true } },
    { id: '5.2', priority: 20, clause: '5.2', when: { op: 'eq', field: 'contractUsable', value: true }, outcome: { decision: 'PO', route: 'CONTRACT_PO', useContract: true } },
    { id: '5.3', priority: 30, clause: '5.3', when: { op: 'and', conditions: [{ op: 'eq', field: 'emergency', value: true }, { op: 'lte', field: 'value', value: 500000 }, { op: 'eq', field: 'recentActiveSupplierPurchase', value: true }] }, outcome: { decision: 'PO', route: 'EMERGENCY_PO', usePreferred: true } },
    { id: '5.4', priority: 40, when: { op: 'and', conditions: [{ op: 'lt', field: 'value', value: 200000 }, { op: 'eq', field: 'recentActiveSupplierPurchase', value: true }] }, outcome: { decision: 'PO', route: 'SPOT_PO', usePreferred: true } },
    { id: '5.5', priority: 50, when: { op: 'lt', field: 'value', value: 1000000 }, outcome: { decision: 'SOURCING_REQUEST', route: 'RFQ', suggestions: 3 } },
    { id: '5.6', priority: 60, when: { op: 'gte', field: 'value', value: 1000000 }, outcome: { decision: 'SOURCING_REQUEST', route: 'RFP', suggestions: 5 } }
  ]
};
