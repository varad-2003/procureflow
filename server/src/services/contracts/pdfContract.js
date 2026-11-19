export function parseContractPdfText(text, filename = '') {
  const safe = String(text || '').replace(/\r/g, '');
  const contractMatch = safe.match(/Contract\s+No\.?\s*(RC-[A-Za-z0-9-]+)/i);
  const supplierMatch = safe.match(/and\s+(.+?),?\s+(?:Pune|Mumbai|Nashik|Nagpur|Chakan|Bhosari)?\s*\([^)]*Supplier\s+ID\s+(S\d+)[^)]*\)/i);
  const supplierIdMatch = safe.match(/Supplier\s+ID\s+(S\d+)/i);
  const startMatch = safe.match(/valid\s+from\s+(\d{4}-\d{2}-\d{2})/i);
  const endMatch = safe.match(/to\s+(\d{4}-\d{2}-\d{2})/i);
  const ceilingMatch = safe.match(/ceiling.{0,100}?INR\s*([\d,]+(?:\.\d+)?)|not\s+exceed\s+INR\s*([\d,]+(?:\.\d+)?)/is);
  const lines = [];
  for (const line of safe.split('\n')) {
    const match = line.match(/^\s*\d+\s+(ITM-\d+)\s+(.+?)\s+(NOS|KG|LTR|MTR|PAIR|JOB|SET|ROLL|BKT|LTR)\s+([\d,]+(?:\.\d+)?)\s*$/i);
    if (match) {
      lines.push({
        itemCode: match[1].toUpperCase(),
        description: match[2].trim(),
        uom: match[3].toUpperCase(),
        rate: Number(match[4].replace(/,/g, ''))
      });
    }
  }
  if (!lines.length) {
    const scheduleMatch = safe.match(/Schedule A: Items and rates([\s\S]*?)(?:For Corvo|Fictional)/i);
    const schedule = scheduleMatch?.[1] || safe;
    const compact = schedule.replace(/\s+/g, '');
    const itemPattern = /(\d)(ITM-\d+)(.*?)NOS([\d,]+\.\d{2})(?=\dITM-|For|$)/gi;
    let match;
    while ((match = itemPattern.exec(compact)) !== null) {
      lines.push({
        itemCode: match[2].toUpperCase(),
        description: match[3].replace(/([a-z])([A-Z])/g, '$1 $2').trim(),
        uom: 'NOS',
        rate: Number(match[4].replace(/,/g, ''))
      });
    }
  }
  const ceilingRaw = (ceilingMatch?.[1] || ceilingMatch?.[2] || '0').replace(/,/g, '');
  return {
    contractId: contractMatch?.[1] || filename.replace(/\.[^.]+$/, ''),
    supplierId: supplierIdMatch?.[1] || null,
    supplierName: supplierMatch?.[1]?.trim() || null,
    startDate: startMatch?.[1] || null,
    endDate: endMatch?.[1] || null,
    valueCap: Number(ceilingRaw),
    consumedValue: 0,
    source: 'signed-pdf',
    verified: false,
    extractedText: text,
    lines
  };
}
