const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (value) => new Set(normalize(value).split(/\s+/).filter(Boolean));
const normalizeDescription = (value) => normalize(value)
  .replace(/\bbrg\b/g, 'bearing')
  .replace(/\bzz\b/g, '2rs')
  .replace(/\b2 z\b/g, '2rs')
  .replace(/\bhose\b/g, 'hose')
  .replace(/\bhyd\b/g, 'hydraulic');
const overlapScore = (query, target) => {
  const qt = [...tokens(query)].filter((token) => token.length > 1);
  const tt = [...tokens(target)];
  if (!qt.length) return 0;
  let overlap = 0;
  for (const token of qt) {
    if (tt.includes(token)) overlap += 1;
    else if (tt.some((candidate) => candidate.startsWith(token) || token.startsWith(candidate))) overlap += 0.7;
  }
  return overlap / qt.length;
};
export function resolveItem(line, items) {
  if (line.itemCode && items.some((item) => item.itemCode === line.itemCode)) return { item: items.find((item) => item.itemCode === line.itemCode), confidence: 1, confirmed: true };
  const query = normalizeDescription(line.description);
  const modelNumbers = query.match(/\b\d+(?:[/.x-]*\d+)*\b/g) || [];
  let best;
  for (const item of items) {
    const target = normalizeDescription(item.description);
    let score = overlapScore(query, target);
    const targetNumbers = target.match(/\b\d+(?:[/.x-]*\d+)*\b/g) || [];
    if (modelNumbers.length && targetNumbers.some((number) => modelNumbers.includes(number))) score = Math.max(score, 0.85);
    if (query.includes(normalizeDescription(item.description)) && query.length > 0) score = 1;
    if (!best || score > best.confidence) best = { item, confidence: score, confirmed: score >= 0.6 };
  }
  return best && best.confidence >= 0.55 ? best : { item: { itemCode: 'NEW', description: line.description, category: 'New Item', itemType: 'Material', standardPrice: line.estimatedUnitPrice }, confidence: best?.confidence || 0, confirmed: false };
}
