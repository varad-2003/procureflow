# ProcureFlow task analysis

## Business requirements

ProcureFlow accepts conversational employee requests and CSV purchase-request batches, resolves items, clubs eligible lines into requirements, evaluates versioned procurement policy, applies contracts and preferred suppliers, and emits one decision row per original PR line. Every decision is traceable to a policy version, clause, source line, price, contract/supplier and audit action.

## Input schemas

- PR batch: `pr_no`, `pr_line`, `created_at`, `requester`, `department`, `plant`, `item_code`, `description`, `quantity`, `uom`, `estimated_unit_price`, `need_by_date`, `urgency`.
- Item master: `item_code`, `description`, `uom`, `category`, `item_type`, `standard_price`.
- Supplier master: `supplier_id`, `name`, `city`, `categories`, `status`, `on_time_pct`, `quality_rating`.
- Plants: `plant`, `name`.
- PO history: `po_number`, `po_date`, `supplier_id`, `item_code`, `quantity`, `uom`, `unit_price`, `plant`, `delivered_on_time`.
- Contracts: register identity, supplier, inclusive dates, ceiling and consumed value; contract lines provide item and rate.

## Policy clauses and routes

Policy v5.0 orders Capex sourcing, usable contract PO, emergency PO up to INR 500,000 with a recent active purchase, spot PO below INR 200,000 with a recent active purchase, RFQ below INR 1,000,000, then RFP at or above INR 1,000,000. New items route to `NEW_ITEM_SOURCING`; blocked/inactive suppliers are excluded.

## Contract processing

Contracts are valid only for active suppliers, inclusive dates, covered items and available ceiling. Signed PDFs are uploadable and must be buyer-verified before use. The data model retains source and verification state.

## Outputs and blind test

Decision export is one row per source PR line with the exact required columns. Policy is stored as data, validated without executable code, approved separately, and selected by effective date so unseen amendments can change behavior without source changes.

## Assumptions

Descriptions are normalized into alphanumeric tokens for deterministic matching; confidence below 0.6 remains unconfirmed. Contract rate is preferred, followed by lowest applicable out-of-ceiling contract rate, request price, then item standard price. Supplier ranking weights frequency 30%, recency 25%, contract history 20%, on-time delivery 15%, quality 10%.
