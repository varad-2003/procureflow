const operators = {
  eq: (a, b) => a === b, neq: (a, b) => a !== b, gt: (a, b) => a > b, gte: (a, b) => a >= b,
  lt: (a, b) => a < b, lte: (a, b) => a <= b, in: (a, b) => Array.isArray(b) && b.includes(a),
  notIn: (a, b) => Array.isArray(b) && !b.includes(a), exists: (a) => a !== undefined && a !== null,
  and: (_, c, ctx) => c.every((x) => evaluateCondition(x, ctx)), or: (_, c, ctx) => c.some((x) => evaluateCondition(x, ctx)),
  not: (_, c, ctx) => !evaluateCondition(c, ctx)
};
export function evaluateCondition(condition, context) {
  if (!condition || typeof condition !== 'object') throw new Error('Invalid policy condition');
  if (condition.op === 'and' || condition.op === 'or') return operators[condition.op](null, condition.conditions || [], context);
  if (condition.op === 'not') return operators.not(null, condition.condition, context);
  if (!operators[condition.op]) throw new Error(`Unsupported policy operator: ${condition.op}`);
  return operators[condition.op](context[condition.field], condition.value, context);
}
export function validatePolicy(policy) {
  if (!policy?.version || !Array.isArray(policy.rules)) throw new Error('Policy requires version and rules');
  for (const rule of policy.rules) {
    if (!rule.id || !rule.when || !rule.outcome || !Number.isFinite(rule.priority)) throw new Error('Invalid policy rule');
    evaluateCondition(rule.when, {});
  }
  return true;
}
export function evaluatePolicy(policy, context) {
  validatePolicy(policy);
  const rule = [...policy.rules].sort((a, b) => a.priority - b.priority).find((candidate) => evaluateCondition(candidate.when, context));
  if (!rule) throw new Error('No applicable policy rule');
  return { ...rule.outcome, clause: rule.clause || rule.id, policyVersion: policy.version };
}
