# Normalization Consistency Audit — 2026-10-29

## Corrections in this revision

1. Removed the unsupported unique constraint on `(customer_id, nominee_name)` from both `bankist_normalized.sql` and `DBMS_LAB_FINAL.sql`. A nominee's name is not inherently a candidate key: two nominees may share a name. The declared candidate key is `nominee_id` unless the project owner confirms a separate business rule.
2. Corrected `bankist_migration.sql` so `allocation_percentage` is migrated as `NULL` when the source does not store a contractual allocation. The previous `100.00` literal invented a business fact and contradicted the stated data-preservation policy.
3. Applied changes to root SQL files and their matching copies under `DBMS project/`.

## Normalization conclusion

The inspected schema is structurally decomposed into 13 base tables, including separate relations for branches, nominees, card credentials, KYC records, deposits, and account liens. The schema's declared primary/unique keys imply the documented functional dependencies for those keys. No unconditional claim of complete BCNF certification is made here: additional business functional dependencies must be supplied by the project owner, and MySQL execution/data migration tests must be run against an isolated disposable database before certification.

## Live database safety

No live database was accessed or changed. The current environment has no `mysql` client/server connection configured. Do not run destructive reset scripts against `bankist`. First take a verified backup, then apply and validate any approved migration against a separate staging database.
