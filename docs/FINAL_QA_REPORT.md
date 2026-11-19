# ProcureFlow Final QA Report

**Report date:** 2026-11-19

**Verification scope:** Live backend tests, 14 worked examples, three preferred-supplier rankings, duplicate batch replay, policy restart hydration, 186-line CSV export, frontend build, and Git privacy.

## Final Acceptance Status

**ALL FINAL ACCEPTANCE CRITERIA PASSED**

| Criterion | Result | Evidence |
|---|---|---|
| Worked examples | **14/14 PASS** | 14 isolated Node test cases passed |
| Preferred supplier examples | **3/3 PASS** | ITM-1048, ITM-1036 and ITM-1016 ranking assertions passed |
| Duplicate batch stability | **PASS** | Identical batch ID and 85 PO IDs on repeated processing |
| Stored run replay | **PASS** | Second upload returned `replayed: true` |
| Policy restart persistence | **PASS** | v5.1 remained ACTIVE; v5.0 became SUPERSEDED |
| CSV export | **186/186 PASS** | 0 missing and 0 extra `(pr_no, pr_line)` pairs |
| Backend tests | **18/18 PASS** | Latest `node --test test/*.test.js` run |
| Frontend production build | **PASS** | Vite production build completed successfully |
| Git/privacy | **PASS** | No task datasets, PDFs, CSVs, `.env` files or secrets staged |

## Latest Backend Test Output

Command:

```powershell
npm --prefix server test
```

Latest result:

```text
tests: 18
passed: 18
failed: 0
```

The suite includes:

- Policy priority and threshold tests.
- Worked examples 1 through 14.
- Three preferred-supplier ranking examples.

## Worked Examples

All 14 scenarios in `Worked_Examples.pdf` passed explicit automated assertions.

| # | Automated assertion |
|---|---|
| 1 | CONTRACT_PO, S001, worked value and contract route |
| 2 | PDF-only contract RC-2026-031 resolves as CONTRACT_PO with S021 |
| 3 | Clubbed requirement routes to RFQ and applies lowest usable contract rate fallback |
| 4 | Lowest ceiling-capable contract is S007 at Precision Fasteners |
| 5 | Split PR lines club into one SPOT_PO requirement for S024 |
| 6 | Same item at PUN1 and CHK1 remains separate |
| 7 | Free-text hose description resolves to ITM-1035 |
| 8 | Emergency requirement routes to EMERGENCY_PO |
| 9 | ₹336,562 requirement routes to RFQ with three supplier suggestions |
| 10 | Small never-bought aluminium plate routes to RFQ with S003, S002 and S005 |
| 11 | Encoder requirement routes to RFP with S020, S017, S019 and S018 |
| 12 | Capex requirement routes to CAPEX_SOURCING with five suppliers |
| 13 | Unknown item routes to NEW_ITEM_SOURCING without supplier suggestions |
| 14 | Qualifying contract requirements share one PO |

## Preferred Supplier Examples

| Item | Expected and verified order |
|---|---|
| ITM-1048 | S029, S030 |
| ITM-1036 | S023, S022, S024 |
| ITM-1016 | S009, S010 |

All three ranking assertions passed in the latest backend suite.

## Duplicate Batch and Policy Runs

The same 186-line CSV was processed twice.

Latest live result:

```json
{
  "one": {
    "batchId": "BATCH-dd057a2e094b8df9",
    "lines": 186,
    "groups": 151,
    "poCount": 85,
    "replayed": false
  },
  "two": {
    "batchId": "BATCH-dd057a2e094b8df9",
    "lines": 186,
    "groups": 151,
    "poCount": 85,
    "replayed": true
  },
  "poIdsEqual": true
}
```

The first identical batch created a stored snapshot. The second identical batch was replayed by policy-versioned batch hash and returned the same batch ID and 85 PO IDs.

## Policy Restart Verification

MongoDB hydration and effective-date normalization verified v5.1 remains ACTIVE after server restart and v5.0 is SUPERSEDED.

Latest API policy state:

```json
[
  {
    "version": "5.1",
    "status": "ACTIVE",
    "effectiveDate": "2026-11-19"
  },
  {
    "version": "5.0",
    "status": "SUPERSEDED",
    "effectiveDate": "2026-04-01"
  }
]
```

Policy history is preserved. Startup does not overwrite database policy records with the hardcoded v5.0 default.

## CSV Export Verification

Latest exact multiset script result:

```json
{
  "inputRows": 186,
  "outputRows": 186,
  "missingCount": 0,
  "extraCount": 0,
  "missing": [],
  "extra": []
}
```

Every original PR number and line number was present exactly once.

## Frontend Build

Command:

```powershell
npm run build
```

Latest output:

```text
1588 modules transformed
vite production build completed successfully
```

## Git and Privacy Verification

Git repository status:

- Repository initialized.
- Source files staged for review.
- `server/.env` is ignored.
- `Cantill_FullStack_Task_Kit/` is ignored.
- `.env` and `.env.*` patterns are ignored.
- No task dataset, PDF, CSV, `.env` file or secret was reported by `git ls-files`.

The privacy verification command found no tracked paths matching:

- `.env`
- `Cantill_FullStack_Task_Kit/`
- `*.csv`
- `*.pdf`
- secret-named files

## Remaining Blockers

**None for the verified acceptance criteria.**

## Historical Test Record

Earlier diagnostic runs documented 12/14 and 16/18 results before supplier ranking and policy/batch fixes. Those failures have been corrected and superseded by the latest 14/14 and 18/18 execution above.

Git task-data privacy was initially not verifiable because the workspace was not a Git repository. Git is now initialized and privacy verification is passing.
