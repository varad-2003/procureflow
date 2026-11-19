export function preferredSuppliers(itemCode, date, suppliers, history, contracts) {
  const cutoff = new Date(new Date(date).getTime() - 548 * 86400000);
  return suppliers.filter((supplier) => supplier.status === 'Active').map((supplier) => {
    const purchases = history.filter((row) => row.itemCode === itemCode && row.supplierId === supplier.supplierId && new Date(row.poDate) >= cutoff && new Date(row.poDate) <= new Date(date))
      .sort((a, b) => new Date(b.poDate) - new Date(a.poDate));
    const contractHistory = contracts.some((c) => c.supplierId === supplier.supplierId && c.lines?.some((l) => l.itemCode === itemCode) && new Date(c.startDate) <= new Date(date));
    if (!purchases.length && !contractHistory) return null;
    const recency = purchases.length ? Math.max(0, 1 - (new Date(date) - new Date(purchases.sort((a, b) => new Date(b.poDate) - new Date(a.poDate))[0].poDate)) / (548 * 86400000)) : 0;
    const frequency = Math.min(purchases.length / 5, 1);
    const score = frequency * 0.3 + recency * 0.25 + (contractHistory ? 0.2 : 0) + (supplier.onTimePct / 100) * 0.15 + (supplier.qualityRating / 5) * 0.1;
    const latest = purchases[0];
    const supplierContracts = contracts
      .filter((contract) => contract.supplierId === supplier.supplierId)
      .flatMap((contract) => (contract.lines || []).filter((line) => line.itemCode === itemCode).map((line) => ({ date: contract.startDate, rate: line.rate })))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return { supplier, score, referencePrice: latest?.unitPrice ?? supplierContracts[0]?.rate };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}

export function suggestSuppliers(itemCode, itemCategory, date, suppliers, history, contracts, count) {
  const preferred = preferredSuppliers(itemCode, date, suppliers, history, contracts);
  const selected = [];
  for (const entry of preferred) {
    if (selected.length < count) selected.push(entry);
  }
  if (selected.length < count) {
    const preferredIds = new Set(preferred.map((entry) => entry.supplier.supplierId));
    const fallback = suppliers
      .filter((supplier) => supplier.status === 'Active')
      .filter((supplier) => !preferredIds.has(supplier.supplierId))
      .filter((supplier) => (supplier.categories || []).includes(itemCategory))
      .sort((a, b) => {
        const scoreA = (Number(a.onTimePct) || 0) * 0.5 + (Number(a.qualityRating) || 0) * 20 * 0.5;
        const scoreB = (Number(b.onTimePct) || 0) * 0.5 + (Number(b.qualityRating) || 0) * 20 * 0.5;
        return scoreB - scoreA || String(a.supplierId).localeCompare(String(b.supplierId));
      });
    for (const supplier of fallback) {
      if (selected.length >= count) break;
      const rank = selected.length + 1;
      selected.push({ supplier, score: 0, referencePrice: undefined, fallbackRank: rank });
    }
  }
  return selected;
}
