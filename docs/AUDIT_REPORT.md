# ProcureFlow Requirements and Accuracy Audit

**Audit date:** 2026-11-19

**Scope:** Actual implementation compared with the Cantill Full-Stack Task Kit, including the task brief, policy v5.0, worked examples, supplied CSVs, and all extracted contract PDFs.

**Constraint:** This audit made no application source-code changes. It added only this report.

## Executive Summary

The implementation contains a usable service boundary and an executable policy evaluator, and the 186-line batch can be processed. However, it does not meet blind-test accuracy or completeness requirements.

The highest-impact failures are:

1. Requirement valuation ignores the policy's recent-PO precedence and instead uses requester estimates.
2. Free-text matching can mark a known item only as 50% confidence or incorrectly classify a known item as NEW.
3. PDF-only contracts are not automatically registered or parsed into contract records.
4. Contract lines and contract ceilings are not reliably imported or allocated in requirement-date order.
5. The exact CSV export omits every `pr_no` when requests pass through `/api/process-batch`.
6. Preferred-supplier suggestions do not include the required category-based fallback.
7. Policy amendments are JSON-only and are not converted from PDF/text by Gemini or a robust parser.
8. MongoDB/Mongoose is not used for runtime state, approval, audit, duplicate prevention or transactions.
9. Gemini is not implemented: chat is a static follow-up response and no structured extraction or amendment drafting occurs.

## Test Evidence

### Executed tests

| Test | Evidence |
|---|---|
| Backend unit tests | `npm test`: 3 tests passed, 0 failed |
| Frontend production build | `npm run build`: passed |
| Policy boundary execution | 200,000; 500,000; 500,000.01; 1,000,000; 14-day; 7-day; 24-hour; ceiling and expiry checks executed |
| Full HTTP 186-line batch | `/api/process-batch` returned 186 input lines and 152 requirement decisions |
| HTTP exact export | `/api/export/decisions` returned the required 13-column header, but `pr_no` was blank for every inspected row |
| Worked-example engine matrix | All 14 examples executed using the actual item, supplier, history and contract source records |
| Preferred-supplier matrix | ITM-1048, ITM-1036 and ITM-1016 executed as of 2026-11-01 |
| Contract PDF extraction | All 12 PDFs were extracted to text and inspected |

The backend unit suite does not cover valuation precedence, PDF contracts, clubbing boundaries, PO consolidation, supplier fallback or exact export.

## 14-Example Coverage Matrix

| # | Expected by Worked_Examples.pdf | Actual engine result | Result |
|---|---|---|---|
| 1 | CONTRACT_PO, S001, contract price, 137531 value, PO | CONTRACT_PO, S001, 9168.71 price, 137530.65 value | **PASS**, apart from normal currency rounding |
| 2 | CONTRACT_PO, S021, 2439.01 price, 26829 value | CONTRACT_PO, S021, 2439.01 price, 26829.11 value | **PASS**, apart from normal currency rounding |
| 3 | Club PR 00004/00026, RFQ, S014/S013/S016, 220256 value | PR 00004 became NEW_ITEM_SOURCING; PR 00026 became SPOT_PO S014 | **FAIL** |
| 4 | CONTRACT_PO, S007, 7.00 price, 32547 value | CONTRACT_PO, S007, 7.06 price, 32546.60 value | **PASS route/supplier/contract choice; FAIL exact price/value rounding against worked rate** |
| 5 | SPOT_PO, S024, 166 reference price, 126472 value | SPOT_PO, S024, 151.18, 114896.80 value | **FAIL** |
| 6 | SPOT_PO S027, separate PUN1 and CHK1 requirements | Both requirements remained separate SPOT_PO S027; PUN1 21.00/154770.00 and CHK1 18.74/121435.20 | **PASS clubbing separation; FAIL price/value** |
| 7 | SPOT_PO, S023, 392.00, 97955 value | SPOT_PO, S023, 459.95, 114987.50 value | **FAIL** |
| 8 | EMERGENCY_PO, S014, 106.00, 253184 value | EMERGENCY_PO, S014, 95.00, 226100.00 value | **FAIL** |
| 9 | RFQ, preferred/topped-up suggestions S043/S044/S042, 336562 value | RFQ, S043/S044 only, 325000 value | **FAIL** |
| 10 | RFQ, S003/S002/S005 suggestions | RFQ, no suggestions | **FAIL** |
| 11 | RFP, S020/S017/S019/S018 suggestions | RFP, S020 only | **FAIL** |
| 12 | CAPEX_SOURCING, 5 suggestions S045/S047/S020/S048/S046 | CAPEX_SOURCING, S045 only, 5800000 value instead of 6036704 | **FAIL** |
| 13 | NEW_ITEM_SOURCING, 141100 value, no suppliers | NEW_ITEM_SOURCING, 141100 value, no suppliers | **PASS** |
| 14 | 4 requirements consolidated to same contract PO | 4 lines formed two requirements, and both ended on the same actual PO ID | **PASS consolidation structure; exact PO numbering is batch-dependent and was not checked in the full worked batch** |

### Preferred-supplier examples

| Example | Executed actual order | Worked order | Result |
|---|---|---|---|
| ITM-1048 as of 2026-11-01 | S029, S030 | S029, S030; S031 excluded Inactive | **PASS ranking order/status** |
| ITM-1036 as of 2026-11-01 | S023, S022, S024 | S023, S022, S024 | **PASS ranking order** |
| ITM-1016 as of 2026-11-01 | S009, S010 | S009, S010 | **PASS ranking order** |

Ranking order happened to match the examples, but ranking is not fully compliant because:

- It has no buyer-visible explanation record or ranked score breakdown.
- Reference price lookup uses unsorted purchases and can cross supplier contracts.
- There is no category-based fallback implementation.
- The export route does not generate real item ranking or reference prices.

## Passed Requirements

The following were executed and pass:

- Node.js 22-compatible ES modules and Express application start.
- React/Vite production build.
- Policy v5.0 priority between contract, emergency, spot, RFQ and RFP rules.
- Policy threshold at exactly ₹10,00,000: RFP.
- Emergency threshold at exactly ₹5,00,000.
- Emergency threshold above ₹5,00,000: RFQ for no recent purchase.
- Normal spot threshold at exactly ₹2,00,000: not spot; RFQ applies.
- New items are never clubbed in the grouping function.
- 14-calendar-day clubbing boundary clubs exactly at 14 days and rejects more than 14 days.
- 7-day need-by boundary is enforced as either side of the first line's need-by date.
- 24-hour PO consolidation boundary joins exactly at 24 hours and does not join beyond 24 hours.
- Contract ceiling exact-fit is accepted and over-ceiling is rejected.
- Contract expiry after end date returns no applicable contract.
- Blocked/inactive suppliers are filtered from the preferred-supplier function.
- The 186-line sample CSV was accepted and produced 186 original lines in the engine.
- PDF text extraction library and PDF upload endpoint exist.

## Failed and Incorrect Requirements

### 1. Valuation precedence is wrong

**Result:** FAIL

The engine does not implement the policy's precedence:

1. contract/lowest contract rate,
2. most recent PO in 365 days,
3. item master standard price.

It instead chooses a positive requester estimate before item standard price and never consults PO history for valuation.

Evidence:

- [server/src/services/procurement/engine.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/engine.js:13): finds a line estimate before the item standard price.
- [server/src/services/procurement/engine.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/engine.js:14): calculates value from that rate.
- [server/src/services/procurement/engine.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/engine.js:11): PO history is not used in requirement valuation.

Business impact: worked values and blind-test thresholds are incorrect, including examples 5, 7, 8, 11 and 12.

### 2. Free-text matching is inaccurate and lacks confirmation

**Result:** FAIL

The `brg 6205 2rs` audit returned ITM-1021 at confidence 0.50 and `confirmed: false`, rather than a safe match with explicit buyer confirmation. Example 3 also resolved `brg 6308 ZZ for maintenance` as NEW even though the item exists in the master.

Evidence:

- [server/src/services/procurement/matching.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/matching.js:3): exact code is blindly trusted.
- [server/src/services/procurement/matching.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/matching.js:6): normalized token-overlap score is the only matching mechanism.
- [server/src/services/procurement/matching.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/matching.js:13): no UI/API confirmation step gates the resolved match.

Business impact: known items become NEW, and example 3 is clubbing and RFQ incorrect.

### 3. Contract ceiling allocation is not persistent or ordered

**Result:** FAIL

The engine chooses among static `consumedValue` values and never updates consumption after a requirement. Multiple requirements are not ordered and allocated through a transaction.

Evidence:

- [server/src/services/procurement/contracts.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/contracts.js:11): computes availability but does not allocate or mutate ceiling.
- [server/src/services/procurement/engine.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/engine.js:10): each requirement chooses contract availability independently.
- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:62): `/api/process-batch` evaluates all decisions in memory only.

Business impact: repeated or multi-line requirements can consume a ceiling twice or choose a contract no longer available.

### 4. PDF-only contracts are not integrated

**Result:** FAIL

All 12 signed PDFs were inspected. The app upload endpoint stores raw extracted text and marks a new contract unverified. It does not extract contract ID, supplier ID, term, ceiling or schedule lines into fields, and does not automatically load all PDF-only contracts.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:76): PDF upload stores `extractedText` only.
- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:77): no verification or field conversion workflow.
- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:62): no PDF contracts are loaded unless manually added by an API caller.

Example 2 passed only because this audit manually added RC-2026-031 to the contract array.

### 5. Exact export omits original PR numbers

**Result:** FAIL

The API process-batch mapping does not set `prNo`, so the export contains blank `pr_no` values. This was confirmed by the HTTP export.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:62): maps `pr_line` but not `pr_no` to `prNo`.
- [server/src/services/csv.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/csv.js:4): requires `line.prNo`.

Business impact: one-row-per-PR-line export fails the primary blind-test output.

### 6. Contract-line import API is broken

**Result:** FAIL

Importing `dataset=contractLines` attached lines correctly at first design level but returned 500 because the response handler tries `state.contractLines.length`, an undefined state key.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:58): response assumes `state[dataset]` exists.

Business impact: contract register and contract lines cannot be reliably imported through the declared admin path.

### 7. Supplier-category fallback is missing

**Result:** FAIL

The preferred-supplier engine does not add category-based active suppliers when the preferred list is short.

Evidence:

- [server/src/services/procurement/engine.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/engine.js:20): suggestions use only `preferred.slice(...)`.
- [server/src/services/procurement/suppliers.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/suppliers.js:2): no category fallback.

Examples 9, 10, 11 and 12 did not receive enough suppliers.

### 8. Reference-price calculation is incorrect

**Result:** FAIL

The preferred-supplier result may use:

- an unsorted or not strictly latest PO,
- a contract from a different supplier,
- no explicit supplier-item constraint for contract lookup.

Evidence:

- [server/src/services/procurement/suppliers.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/suppliers.js:13): `purchases[0]` is not sorted independently.
- [server/src/services/procurement/suppliers.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/suppliers.js:14): contract lookup flattens contracts without constraining supplier ID.

### 9. Policy effective date is wrong

**Result:** FAIL

Corvo policy v5.0 is effective 1 April 2026. The implementation record says 1 January 2026.

Evidence:

- [server/src/services/policy/defaultPolicy.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/policy/defaultPolicy.js:2): `effectiveDate: '2026-01-01'`.
- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:45): effective policy is selected once for the whole batch based on the first input line, not per requirement.

### 10. Amendment workflow is not policy-document ready

**Result:** FAIL

The application accepts JSON policy objects only or raw JSON uploaded. It has no Gemini parsing, plain-language old/new diff, change summary validation for unknown outcomes, or PDF amendment extraction.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:68): policy upload executes `JSON.parse`.
- [server/src/services/policy/evaluator.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/policy/evaluator.js:14): validation does not reject unknown outcome fields or unsupported fields.
- No Gemini service file exists.

### 11. Reprocessing under an approved amendment is not persistent or demonstrably reliable

**Result:** FAIL

The policy list is in memory, and `/api/process-batch` has no batch identity/deduplication. Restarting the server loses state.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:17): policies and decisions are module memory.
- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:62): no duplicate batch key or persisted batch snapshot.

### 12. Gemini chat and amendment drafting are absent

**Result:** FAIL

Chat echoes no extracted fields and always returns the same missing-item list. It does not parse natural language, ask dynamic follow-ups, confirm item matches or create a PR.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:79): static response.
- [client/src/main.jsx](C:/Users/Lenovo/Desktop/procure%20flow/client/src/main.jsx:14): sends raw text and displays a static reply.
- `GEMINI_API_KEY` is only configuration; no SDK call exists.

### 13. Runtime persistence and transaction guarantees are missing

**Result:** FAIL

Mongoose schemas exist, but no operational route writes to them. State is reset on restart. MongoDB may remain disconnected; this was confirmed by `/api/health`.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:17): in-memory state.
- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:83): connection attempts do not affect state.
- [server/src/models/index.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/models/index.js:1): models exist but are not used by routes.

### 14. Duplicate PO prevention is missing

**Result:** FAIL

Reprocessing creates new in-memory PO IDs and consolidations rather than detecting a previously processed batch or reusing immutable decisions.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:62): batch ID uses `Date.now()` with no duplicate hash.
- [server/src/services/procurement/engine.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/engine.js:27): PO IDs are generated again for every call.

### 15. Buyer approval and override audit trail is incomplete

**Result:** PARTIAL FAIL

The API accepts approval/override and stores in-memory fields, but:

- it does not use `AuditLog`,
- it does not persist approval history,
- override preserves only mutable fields on the in-memory decision,
- no role enforcement verifies buyer/procurement/admin.
- the no `/api/admin/audit-logs` endpoint exists.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:64): approval stores only in the decision object.
- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:65): override stores no original immutable decision snapshot.
- [server/src/models/index.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/models/index.js:51): AuditLog model exists but is unused.

### 16. Security authorization is incomplete

**Result:** FAIL

All authenticated users can call admin/buyer endpoints; there is no role guard. The default development JWT secret is weak if environment configuration is omitted.

Evidence:

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:21): authentication only verifies a token.
- [server/src/config/env.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/config/env.js:6): fallback JWT secret is hardcoded.
- Admin, policy approval and PDF endpoints have no role restriction.

### 17. CSV validation is insufficient

**Result:** FAIL

The parser detects PapaParse syntax errors but does not enforce required columns, numeric quantities/prices, date formats, plant references, duplicate PR/line records or invalid item/supplier references.

Evidence:

- [server/src/services/csv.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/csv.js:2): only PapaParse parse.
- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js:62): numeric conversion is not followed by validation.

### 18. Several required API endpoints are missing

**Result:** FAIL

Missing or mismatched:

- no `POST /api/pr`; only `/api/pr/upload`
- no `POST /api/pr` for structured PR creation
- no `GET /api/admin/audit-logs`
- no dynamic preferred-supplier export with item ranking and exact top-3 representation
- no real supplier/category fallback route

## Missing Features

- Gemini structured chat extraction and missing-field follow-ups
- Gemini policy-amendment parsing and diff generation
- Dynamic item match confirmation and unknown-item workflow
- PDF field extraction and verification
- Contract ceiling allocation in requirement-date order
- MongoDB-backed batch, requirement, PO, decision and audit persistence
- Duplicate batch and PO prevention
- Role-based authorization
- Complete CSV validation
- Supplier ranking explanations and export
- Buyer RFQ/RFP initiation workflow
- Docker Compose and deployment configuration
- Automated worked-example and blind-test fixture suite

## Boundary Test Evidence

| Boundary | Executed result | Status |
|---|---|---|
| ₹2,00,000, no recent purchase | RFQ | PASS |
| ₹199,999.99, recent active purchase | SPOT_PO | PASS |
| Exactly ₹2,00,000 | RFQ | PASS |
| ₹5,00,000 emergency, recent purchase | EMERGENCY_PO | PASS |
| ₹5,00,000.01 emergency, recent purchase | RFQ | PASS |
| Exactly ₹10,00,000 | RFP | PASS |
| 14 calendar days exactly | Clubbed | PASS |
| More than 14 calendar days | Separate requirements | PASS |
| Need-by exactly 7 days away | Clubbed | PASS |
| Need-by more than 7 days away | Separate requirements | PASS |
| PO consolidation exactly 24 hours | Same PO | PASS |
| PO consolidation more than 24 hours | Separate POs | PASS |
| Contract ceiling exact fit | Usable | PASS |
| Contract ceiling over by any amount | Unusable | PASS |
| Contract expiry | No applicable contract | PASS |

## 186-Line Batch Evidence

The full HTTP run:

- imported 73 items,
- imported 48 suppliers,
- imported 2 plants,
- imported 468 PO-history rows,
- imported 10 register contracts,
- manually supplied RC-2026-031 for PDF-only audit,
- processed 186 input lines,
- created 152 requirement decisions.

The contract-lines endpoint failed, so the HTTP run did not validate the register line import completely. The exact CSV export exposed blank `pr_no` values. The 186-line source count passed, but the blind-test-ready accuracy/export requirements did not.

## Security and Privacy Audit

Passed:

- Supplied task kit is excluded by `.gitignore`.
- Gemini key and MongoDB URI are intended to remain server/environment variables.
- Uploaded files use a server-side upload destination.
- API key values do not appear in frontend source.

Failed or incomplete:

- Runtime state is in memory and unauthenticated public read endpoints expose decisions and supplier/contract data.
- `/api/auth/register` exposes role selection, allowing a caller to register as ADMIN.
- No role-based authorization protects imports, policy approval or PDF contracts.
- Upload endpoints do not validate MIME/PDF or sanitize file names beyond Multer defaults.
- The default JWT secret is hardcoded and must not be used outside local development.
- MongoDB credentials and API keys are not exposed in source, but no production hardening/deployment was executed.
- No hosted URL was tested.

## Recommended Fixes Ordered by Business Impact

1. **Fix exact PR numbering and CSV export**
   - Add `prNo: r.pr_no` to `/api/process-batch`.
   - Add exact 186-row export test and duplicate PR/line validation.

2. **Fix requirement valuation and PO-history precedence**
   - Use usable contract rate, otherwise lowest applicable contract rate, otherwise most recent PO in the 365-day window, otherwise item standard price.
   - Use requester estimated price only for NEW items.

3. **Fix item matching**
   - Improve abbreviation/description matching and confirm all scores below a high confidence threshold.
   - Implement a visible buyer-confirmation state and never silently route uncertain matches.

4. **Fix clubbing and expected example 3**
   - Ensure resolved ITM-1022 joins PR 00004 and 00026, and keep every requirement-data trace.

5. **Implement real contract registry/import and ceiling allocation**
   - Fix `contractLines` import response.
   - Parse register/PDFs into contract and line records.
   - Sort requirements by requirement date and atomically consume ceilings.

6. **Implement PDF-only contract extraction**
   - Extract contract ID, supplier ID, dates, ceiling and schedule items/rates.
   - Require buyer verification before activation.
   - Seed all 12 signed PDFs or import them as actual records.

7. **Fix supplier suggestions and reference prices**
   - Add category fallback ranked by on-time and quality.
   - Constrain reference PO/contracts to the actual supplier and item.
   - Sort purchases by PO date before selecting latest.

8. **Implement MongoDB persistence**
   - Move all runtime state into Mongoose.
   - Persist policy, decisions, requirements, batches, POs and audit logs.
   - Use transactions for PO generation and ceiling allocation.

9. **Implement policy effective-date and amendment reliability**
   - Correct v5.0 to 2026-04-01.
   - Evaluate one policy per requirement date.
   - Add strict amendment schema/diff and reprocessing snapshot.

10. **Implement Gemini chat and policy services**
    - Structured extraction, missing-field prompts, item confirmation and PR confirmation summary.
    - Structured amendment parsing with validation and no silent rule omission.

11. **Add role authorization and audit**
    - EMPLOYEE, BUYER and ADMIN role guards.
    - Remove role selection from public registration or restrict it.
    - Implement original decision and immutable override/approval history.

12. **Add complete CSV validation and duplicate prevention**
    - Required columns, date/numeric/plant/duplicate checks.
    - Batch hashes and existing batch/PO reuse rules.

13. **Complete UI and deployment**
    - Add missing requirement, policy, contract, supplier, sourcing and audit screens.
    - Add Docker Compose, hosted deployment, health and environment setup.

## Files Most Relevant to Findings

- [server/src/app.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/app.js)
- [server/src/services/procurement/engine.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/engine.js)
- [server/src/services/procurement/matching.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/matching.js)
- [server/src/services/procurement/grouping.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/grouping.js)
- [server/src/services/procurement/contracts.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/contracts.js)
- [server/src/services/procurement/suppliers.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/procurement/suppliers.js)
- [server/src/services/csv.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/csv.js)
- [server/src/services/policy/defaultPolicy.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/policy/defaultPolicy.js)
- [server/src/services/policy/evaluator.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/services/policy/evaluator.js)
- [server/src/models/index.js](C:/Users/Lenovo/Desktop/procure%20flow/server/src/models/index.js)
- [server/test/policy.test.js](C:/Users/Lenovo/Desktop/procure%20flow/server/test/policy.test.js)
- [client/src/main.jsx](C:/Users/Lenovo/Desktop/procure%20flow/client/src/main.jsx)
