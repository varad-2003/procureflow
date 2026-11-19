# Implementation decisions

- **Item matching:** exact supplied codes win; otherwise normalized-token overlap is used. Matches below 0.6 confidence require confirmation, and no match becomes `NEW`.
- **Missing price:** usable contract rate first; if every applicable contract is out of ceiling, the lowest applicable contract rate; otherwise the most recent item PO within 365 days; otherwise item standard price. New items use the requester's estimated unit price.
- **Supplier ranking:** frequency 30%, recency 25%, contract history 20%, on-time delivery 15%, quality 10%. Only active suppliers are eligible.
- **Category fallback:** active category suppliers are ranked by a combined delivery/quality score: on-time percentage 50% and quality rating scaled to 50%, with supplier ID as a deterministic tie-breaker.
- **Policy dates:** the active policy with the latest effective date not after the requirement date is used.
- **Invalid records:** import and processing errors are returned to the caller; records are not silently discarded.
- **PDF contracts:** extracted fields require buyer verification before being treated as an applicable contract.
