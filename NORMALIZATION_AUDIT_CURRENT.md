# BTB / Bankist — Current Normalization Audit

**Review type:** Static SQL review of the uploaded project ZIP. MySQL was not available in this environment, so no SQL was executed and the live database was not accessed.

## Concrete corrections made

- Removed the unsupported `(customer_id, nominee_name)` unique key from both normalized schema and lab schema. `nominee_id` is the only declared candidate key for `customer_nominees` unless a separate business rule is confirmed.
- Fixed the migration script to preserve an unknown nominee allocation as `NULL` instead of inventing `100.00`.
- Kept root SQL files synchronized with the copies in `DBMS project/`.
- Replaced unsupported blanket BCNF/zero-redundancy certification wording with a clear verification limitation.

## Functional dependencies implied by declared keys

| Relation | Declared determinant(s) | Attributes determined | Review note |
|---|---|---|---|
| `branches` | `branch_id`; `ifsc_code` (unique) | All other branch attributes | BCNF under these declared dependencies. |
| `customers` | `customer_id`; `email` (unique); non-NULL `pan_number` (unique) | All other customer attributes | Verify that email/PAN uniqueness reflects business rules and handle nullable PAN correctly. |
| `customer_nominees` | `nominee_id` | All other nominee attributes | No uniqueness assumed for a person's name. |
| `accounts` | `account_number` | All other account attributes | Branch details are referenced through `ifsc_code`, not duplicated in this relation. |
| `account_card_credentials` | `credential_id`; `account_number` (unique) | All other credential attributes | Assumes one credential record per account; confirm if multiple cards per account are required. |
| `transactions` | `transaction_id`; non-NULL `reference_number` (unique) | All other transaction attributes | Nullable references are not candidate keys for rows where they are NULL. |
| `deposits` | `deposit_id` | All other deposit attributes | Confirm whether maturity amount is contractually stored or deterministically derived by a documented product formula. |
| `beneficiaries` | `beneficiary_id`; `(customer_id, account_number, ifsc_code)` (unique) | All other beneficiary attributes | Confirm the composite uniqueness rule matches desired beneficiary behavior. |
| `kyc_verifications` | `verification_id` | All other KYC attributes | Repeated documents may be legitimate history; do not add uniqueness without a rule. |
| `otp_sessions` | `session_id` | All other session attributes | Session history should remain separate from customer profile. |
| `security_rate_limits` | `key_id` | All other rate-limit attributes | BCNF under declared key dependency. |
| `account_lien_records` | `lien_id` | All other lien attributes | Separate relation prevents repeating lien data in accounts. |
| `audit_logs` | `log_id` | All other audit attributes | Append-only audit design is an operational rule, not established by normalization alone. |

## Normal-form status

- **1NF:** The DDL uses scalar columns and separate child relations for repeating nominee/credential data. This is a structural assessment; actual stored values should still be checked.
- **2NF:** Under the declared dependencies, the listed tables use single-column primary keys except where alternate unique keys exist; no partial dependency is evident from the DDL alone.
- **3NF / BCNF:** The DDL separates branch attributes from accounts and removes duplicated customer ownership from deposits. Under only the functional dependencies explicitly implied by declared keys, these relations are consistent with BCNF. This is conditional, not a proof that no additional business dependencies exist.
- **Not certified:** Data-level anomalies, lossless-join properties for the complete source decomposition, dependency preservation, migration parity, application compatibility, and live DB state have not been runtime-tested here.

## Required before touching the live database

1. Take a verified backup and record its restore test.
2. Use a dedicated staging database with a different name from `bankist`.
3. Apply schema and migration to staging; run all tests and app compatibility checks.
4. Compare row counts and financial aggregates from source and target; manually review intentional decompositions and any synthetic reference rows.
5. Prepare a reviewed production migration/rollback plan. Do not run `DROP`, reset, or migration scripts against `bankist` until the plan is approved and a verified backup exists.
