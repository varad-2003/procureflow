const day = 86400000;
const calendarDate = (value) => {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};
export function groupRequirements(lines) {
  const sorted = [...lines].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || String(a.prNo).localeCompare(String(b.prNo)) || a.prLine - b.prLine);
  const groups = [];
  for (const line of sorted) {
    if (line.resolvedItemCode === 'NEW') { groups.push({ lines: [line] }); continue; }
    const candidate = groups.find((group) => {
      const first = group.lines[0];
      return first.resolvedItemCode === line.resolvedItemCode && first.plant === line.plant &&
        (calendarDate(line.createdAt) - calendarDate(first.createdAt)) <= 14 * day &&
        Math.abs(calendarDate(line.needByDate) - calendarDate(first.needByDate)) <= 7 * day;
    });
    (candidate || groups[groups.push({ lines: [] }) - 1]).lines.push(line);
  }
  return groups.map((group, index) => ({ ...group, groupId: `REQ-${String(index + 1).padStart(5, '0')}` }));
}
