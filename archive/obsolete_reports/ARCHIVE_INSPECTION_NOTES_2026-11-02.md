# Archive inspection notes — 2 November 2026

## Scope

Inspected the uploaded ZIP contents, the root `bankist_normalized.sql`,
`DBMS_LAB_FINAL.sql`, the runtime `lib/db.ts`, selected API code, CSV files,
the CSV importer, and the AI Copilot route. No database connection was opened,
no migration was executed, and no live data was changed. A build/test run was
not performed because the uploaded project has no `node_modules` directory.

## Static schema inventory

`bankist_normalized.sql` defines 13 base tables:

branches, customers, customer_nominees, accounts,
account_card_credentials, transactions, deposits, beneficiaries,
kyc_verifications, otp_sessions, security_rate_limits,
account_lien_records, audit_logs.

Declared key structure indicates that most relations are BCNF under the
functional dependencies explicitly represented by their primary/unique keys.
That is not a mathematical proof of BCNF under every real business rule:
additional business dependencies must be stated and checked separately.

### Key caveats

- `customers.pan_number` is nullable UNIQUE. It is not a candidate key for the
  complete relation because NULL is permitted; describe it as a uniqueness
  constraint on supplied PAN values, not an unconditional candidate key.
- `transactions.reference_number` is nullable UNIQUE. It is not an
  unconditional candidate key for the full relation.
- The beneficiary composite UNIQUE key is `(customer_id, account_number,
  ifsc_code)`. Confirm that the business rule really says this triple identifies
  a beneficiary; if beneficiary display identity can differ for the same triple,
  this constraint may be too restrictive.
- BCNF depends on all valid business FDs, not only declared SQL constraints.
- Foreign keys preserve referential integrity but do not by themselves preserve
  every cross-relation functional dependency in the formal dependency-
  preservation sense.

## Important implementation inconsistencies

1. Root-level CSV files use the pre-normalized layout, while
   `bankist_normalized.sql` uses the decomposed BCNF layout.
2. `scripts/import_csv_data.js` still targets legacy columns such as
   `accounts.branch_name`, `accounts.card_pin`, `customers.nominee_name`,
   `beneficiaries.bank_name`, and `deposits.customer_id`. It does not import the
   two decomposed relations as independent tables.
3. That importer defaults to `DB_NAME=bankist` and has a live-import mode unless
   `--dry-run` is supplied. Do not execute it against a real database during
   submission preparation.
4. The runtime schema in `lib/db.ts` is another schema definition and is not
   byte-for-byte equivalent to the standalone normalized SQL. Treat schema
   parity between runtime initialization, lab SQL, migration SQL, and import
   scripts as a required final verification.
5. The AI route falls back to hardcoded financial heuristics when Gemini is
   unavailable. One branch hardcodes a 7.5% FD rate and a projected return.
   These must be labelled as illustrative demo assumptions or removed from
   customer-facing factual answers; they are not live bank product data.
6. The uploaded CSVs contain plaintext card PIN / OTP source columns. The new
   `data/bcnf` export omits them, but the original root-level source CSVs remain
   unchanged for compatibility. Do not distribute those legacy source files
   unless the values are confirmed synthetic and the exposure is accepted.
7. The source CSV PIN hashes are SHA-256 digests. They are not bcrypt hashes.
   The archive's existing test code expects bcrypt in the database, so the
   import/migration path must explicitly reconcile this rather than assuming
   the 64-character digests are already secure password hashes.

## Generated normalized CSV export

See `data/bcnf/`. It contains one CSV per normalized base table, including
`customer_nominees.csv` and `account_card_credentials.csv`. The export has
zero orphan rows for the tested parent-child relationships and no plaintext
PIN/OTP columns.

## Recommended pre-submission order

1. Do not run any script that defaults to `bankist` unless explicitly reviewed.
2. Reconcile the importer and runtime schema with the normalized SQL.
3. Verify card PIN migration and ensure no plaintext or SHA-256-only PIN
   verifier remains.
4. Ensure the AI UI clearly distinguishes Gemini responses from deterministic
   demo calculations and never invents live rates.
5. Run type-check, production build, DBMS SQL tests, and API regression tests
   only against a disposable database.
6. Freeze code after all checks pass; retain rollback and backup material.
