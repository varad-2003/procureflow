# ProcureFlow approach

The backend separates HTTP, import/validation, deterministic procurement services, policy evaluation, and persistence models. The evaluator supports a small declarative condition language (`eq`, `neq`, comparisons, membership, existence, boolean composition) and rejects unsupported operators rather than executing policy text.

MongoDB is used for policy, purchase-request, requirement, purchase-order, decision, chat and batch-run persistence. At startup, the backend hydrates persisted policy records and normalizes a single active policy by effective date.

Gemini is an optional backend-only adapter for chat extraction and amendment drafting. It never makes the final procurement decision; the deterministic engine evaluates the approved policy document.

The client is a Vite React application consuming the API. Company task data is intentionally excluded from version control and is imported at runtime.
