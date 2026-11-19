export function applicableContracts(contracts, itemCode, date, suppliers) {
  const when = new Date(date);
  return contracts.filter((contract) => {
    const supplier = suppliers.find((s) => s.supplierId === contract.supplierId);
    return supplier?.status === 'Active' && when >= new Date(contract.startDate) && when <= new Date(contract.endDate) &&
      contract.lines?.some((line) => line.itemCode === itemCode);
  }).map((contract) => ({ contract, line: contract.lines.find((line) => line.itemCode === itemCode) }));
}
export function chooseContract(candidates, quantity) {
  return candidates.filter(({ contract, line }) => (contract.valueCap - (contract.consumedValue || 0)) >= quantity * line.rate)
    .sort((a, b) => a.line.rate - b.line.rate)[0] || null;
}
