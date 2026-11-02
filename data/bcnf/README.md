# BCNF-normalized CSV dataset

This folder contains a separate CSV export aligned to the 13-table schema in
`bankist_normalized.sql`. The original root-level CSV files were intentionally
left untouched because the existing legacy importer still expects their older
column layout.

## Included tables and source row counts

| Table | Rows |
|---|---:|
| branches | 5 |
| customers | 50 |
| customer_nominees | 50 |
| accounts | 68 |
| account_card_credentials | 68 |
| transactions | 160 |
| deposits | 26 |
| beneficiaries | 99 |
| kyc_verifications | 250 |
| otp_sessions | 50 |
| security_rate_limits | 20 |
| account_lien_records | 15 |
| audit_logs | 100 |

## Normalization mappings

- `accounts.branch_name` is removed; branch details are represented by `ifsc_code`
  and belong in `branches`.
- `accounts.card_pin` and `customers.card_pin` are omitted. Card hashes are moved
  to `account_card_credentials`.
- `customers.nominee_name`, `nominee_relation`, and `nominee_dob` are moved to
  `customer_nominees`.
- `deposits.customer_id` is omitted; ownership is derived through
  `deposits.linked_account -> accounts.customer_id`.
- `beneficiaries.bank_name` is omitted; bank/branch details are derived through
  `ifsc_code -> branches`.
- `otp_sessions.otp_code` is omitted; only `otp_hash` is exported.

## Validation performed

- CSVs parsed successfully.
- All generated foreign-key relationships checked against the exported parent
  datasets had zero orphan rows.
- No plaintext `card_pin` or `otp_code` columns are present in these exports.

## Important limitations

- This is a data-export patch, not a replacement for the existing importer.
  The existing `scripts/import_csv_data.js` still expects legacy root CSV
  columns and defaults to the `bankist` database. Do not run it for this
  normalized export.
- Existing `card_pin_hash` values in the source CSVs are 64-character SHA-256
  digests, not bcrypt hashes. SHA-256 alone is unsuitable for low-entropy PINs.
  A secure migration should verify the current application's PIN-verification
  flow and re-hash from a trusted plaintext input using an appropriate
  password/PIN hashing scheme; do not silently relabel these hashes as bcrypt.
- The generated IDs `NOM-0001...` and `CRED-0001...` are deterministic export IDs.
  They are for this demo dataset only.
