# BHARAT TRUST BANK (BTB) — COMPREHENSIVE DATABASE NORMALIZATION REPORT
## Table-by-Table Mathematical Normalization: 1NF to BCNF (Boyce-Codd Normal Form)

- **Institution:** Bharat Trust Bank (BTB) / Bankist Banking System
- **Database Engine:** MySQL 8.0.42 Community Server (InnoDB Storage Engine)
- **Authoritative SQL Files:** `DBMS_LAB_FINAL.sql` & `DBMS project/bankist_normalized.sql`
- **Audit Date:** October 2026
- **Evaluation Target:** College DBMS Viva & Lab Evaluation

---

## 1. Summary Normalization Matrix

| Table | Candidate Key(s) | Important Functional Dependencies | 1NF | 2NF | 3NF | BCNF | Status / Verdict |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **`branches`** | $\{branch\_id\}$, $\{ifsc\_code\}$ | $branch\_id \leftrightarrow ifsc\_code \to \{bank\_name, branch\_name, city, address, timing, phone, status\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Every determinant is a candidate key. |
| **`customers`** | $\{customer\_id\}$, $\{email\}$, $\{pan\_number\}$ | $customer\_id \to \{full\_name, email, phone, dob, address, status, kyc\_status, password\_hash, credit\_score, tier, pan\_number, aadhaar\_number\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Multi-valued nominee and card PIN facts decomposed. |
| **`customer_nominees`** | $\{nominee\_id\}$, $\{customer\_id, nominee\_name\}$ | $nominee\_id \leftrightarrow \{customer\_id, nominee\_name\} \to \{relationship, dob, allocation\_percentage\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Resolves 1NF repeating group in customer profile. |
| **`accounts`** | $\{account\_number\}$ | $account\_number \to \{customer\_id, account\_type, balance, ifsc\_code, opening\_date, status\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Branch details normalized via `ifsc_code` FK. |
| **`account_card_credentials`** | $\{credential\_id\}$, $\{account\_number\}$ | $credential\_id \leftrightarrow account\_number \to \{card\_pin\_hash, status, created\_at, updated\_at\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Customer ownership redundancy eliminated; derived via `accounts`. |
| **`transactions`** | $\{transaction\_id\}$, $\{reference\_number\}$ | $transaction\_id \leftrightarrow reference\_number \to \{sender\_account, receiver\_account, channel, amount, type, date\_time, status, description\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Atomic double-entry financial ledger. |
| **`deposits`** | $\{deposit\_id\}$ | $deposit\_id \to \{linked\_account, deposit\_type, principal\_amount, interest\_rate, tenure\_months, maturity\_amount, maturity\_date, status\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Redundant `customer_id` removed; resolved via `linked_account -> accounts`. |
| **`beneficiaries`** | $\{beneficiary\_id\}$, $\{customer\_id, account\_number, ifsc\_code\}$ | $beneficiary\_id \leftrightarrow \{customer\_id, account\_number, ifsc\_code\} \to \{beneficiary\_name, transfer\_limit, cooling\_until, is\_active\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Transitive `bank_name` removed; resolved via `branches(ifsc_code)`. |
| **`audit_logs`** | $\{log\_id\}$ | $log\_id \to \{customer\_id, action, entity\_type, entity\_id, details, timestamp\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Immutable compliance audit log. |
| **`account_liens`** | $\{lien\_id\}$ | $lien\_id \to \{account\_number, lien\_amount, reason, placed_by, status, placed\_at, released\_at\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Legal encumbrance holds. |
| **`customer_kyc`** | $\{kyc\_id\}$, $\{customer\_id\}$ | $kyc\_id \leftrightarrow customer\_id \to \{document\_type, document\_number, verification\_method, status, verified\_at\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. 1:1 regulatory identity relation. |
| **`security_rate_limits`** | $\{rate\_key\}$ | $rate\_key \to \{failed\_attempts, first\_attempt\_at, last\_attempt\_at, locked\_until\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Anti-brute-force defense state. |
| **`branch_summary_mv`** | $\{ifsc\_code\}$ | $ifsc\_code \to \{branch\_name, total\_accounts, total\_balance, total\_active\_customers, last\_refreshed\_at\}$ | Yes | Yes | Yes | **Yes** | **BCNF**. Materialized view table for branch aggregations. |

---

## 2. Before-and-After Decomposition Analysis & Anomaly Elimination

### A. Table: `deposits` (Fixed / Recurring Deposits)
- **Before Normalization:**
  - Attributes: `(deposit_id, customer_id, linked_account, deposit_type, principal_amount, ...)`
  - Functional Dependencies:
    - $FD_1: deposit\_id \to \{customer\_id, linked\_account, \dots\}$
    - $FD_2: linked\_account \to customer\_id$ (since each account belongs to exactly one customer)
  - **Violation:** In `deposits`, the candidate key is only $\{deposit\_id\}$. The determinant $linked\_account$ is **NOT a superkey**.
  - Since $deposit\_id \to linked\_account \to customer\_id$, the attribute `customer_id` is transitively dependent on a non-superkey. This violates **3NF** and **BCNF**.
  - **Relational Anomalies:**
    - *Insertion Anomaly:* An application could insert a deposit with account `ACC-1001` (owned by `CUST-101`) but assign `customer_id = 'CUST-102'`, creating conflicting ownership data.
    - *Update Anomaly:* If an account ownership transfer occurs, updating `accounts` without updating `deposits` leads to inconsistent financial ownership.
  - **After Normalization:**
    - `deposits` table: `(deposit_id PK, linked_account FK, deposit_type, principal_amount, interest_rate, tenure_months, maturity_amount, maturity_date, status, created_at)`
    - Ownership is derived losslessly: `JOIN accounts a ON deposits.linked_account = a.account_number`.
    - Transitive dependency eliminated. **BCNF Achieved**.

### B. Table: `beneficiaries` (Payee Directory)
- **Before Normalization:**
  - Attributes: `(beneficiary_id, customer_id, beneficiary_name, account_number, ifsc_code, bank_name, ...)`
  - Functional Dependencies:
    - $FD_1: beneficiary\_id \to \{customer\_id, account\_number, ifsc\_code, bank\_name, \dots\}$
    - $FD_2: ifsc\_code \to bank\_name$ (the bank is functionally determined by the IFSC prefix/code)
  - **Violation:** In `beneficiaries`, candidate keys are $\{beneficiary\_id\}$ and $\{customer\_id, account\_number, ifsc\_code\}$. The determinant $ifsc\_code$ is **NOT a superkey**.
  - Since $beneficiary\_id \to ifsc\_code \to bank\_name$, `bank_name` is transitively dependent on a non-superkey. This violates **3NF** and **BCNF**.
  - **Relational Anomalies:**
    - *Update Anomaly:* If a bank changes its legal trade name or branch title, thousands of beneficiary records storing that string would need updating, risking partial updates.
    - *Redundancy:* Every customer saving an account at `BTBI0002018` duplicated the string `"Bharat Trust Bank (MG Road)"`.
  - **After Normalization:**
    - `branches` relation holds: `(ifsc_code UQ, bank_name, branch_name, city, address, ...)`
    - `beneficiaries` table holds: `(beneficiary_id PK, customer_id FK, beneficiary_name, account_number, ifsc_code FK, transfer_limit, cooling_until, is_active, created_at)`
    - `bank_name` is removed from `beneficiaries` and resolved dynamically via `branches(ifsc_code)`. **BCNF Achieved**.

### C. Table: `account_card_credentials` (Card PIN Hashes)
- **Before Normalization:**
  - Stored `(credential_id, account_number, customer_id, card_pin_hash, status)`
  - Account `account_number` already uniquely determines `customer_id` via `accounts(account_number)`.
  - Storing `customer_id` duplicated account ownership facts and allowed potential mismatch between `accounts.customer_id` and `account_card_credentials.customer_id`.
  - **After Normalization:**
    - Table: `(credential_id PK, account_number UQ FK, card_pin_hash, status, created_at, updated_at)`
    - Redundant customer ownership removed. Resolves through `accounts`. **BCNF Achieved**.

### D. Table: `customers` & `customer_nominees`
- **Before Normalization:**
  - Stored repeating nominee columns `(nominee_name, nominee_relation, nominee_dob)` inside the customer master table.
  - Violated **1NF** (repeating groups and restriction to single nominee).
  - **After Normalization:**
    - Decomposed into 1:N relation `customer_nominees(nominee_id PK, customer_id FK, nominee_name, relationship, dob, allocation_percentage)`.
    - Preserved 100% backward compatibility via `v_customers_legacy` view using `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY allocation_percentage DESC)` window function without triggering MySQL Error 1055 (`ONLY_FULL_GROUP_BY`).

---

## 3. Mathematical Proof of Lossless-Join Decomposition

Let relation $R = \{deposit\_id, linked\_account, customer\_id, principal\_amount\}$ be decomposed into:
- $R_1 = \{deposit\_id, linked\_account, principal\_amount\}$
- $R_2 = \{linked\_account, customer\_id\}$ (from `accounts`)

**Theorem:** A decomposition of $R$ into $\{R_1, R_2\}$ is lossless with respect to a set of functional dependencies $F$ if and only if:
$$(R_1 \cap R_2) \to R_1 \quad \text{OR} \quad (R_1 \cap R_2) \to R_2$$

**Proof:**
1. Compute the common attribute set:
   $$R_1 \cap R_2 = \{linked\_account\}$$
2. In the `accounts` schema, `account_number` (which corresponds to `linked_account`) is a candidate key.
3. Therefore:
   $$\{linked\_account\} \to \{customer\_id\}$$
   which means $(R_1 \cap R_2) \to R_2$.
4. By the Relational Decomposition Theorem, the natural join $R_1 \bowtie R_2$ reconstructs $R$ identically:
   $$\Pi_{R_1}(r) \bowtie \Pi_{R_2}(r) = r$$
5. No spurious tuples can be generated, and no data is lost.
6. Therefore, the decomposition is **Lossless**. $\blacksquare$

---

## 4. Dependency Preservation Analysis

- **Definition:** A decomposition of schema $R$ with FDs $F$ into $\{R_1, R_2, \dots, R_k\}$ preserves dependencies if:
  $$(F_1 \cup F_2 \cup \dots \cup F_k)^+ = F^+$$
  where $F_i$ is the projection of $F$ onto $R_i$.
- **Verification:**
  1. $deposit\_id \to linked\_account$: Enforced by Primary Key on `deposits(deposit_id)`.
  2. $linked\_account \to customer\_id$: Enforced by Primary Key on `accounts(account_number)`.
  3. $ifsc\_code \to bank\_name$: Enforced by Unique Key on `branches(ifsc_code)`.
  4. $beneficiary\_id \to \{customer\_id, account\_number, ifsc\_code\}$: Enforced by Primary Key on `beneficiaries(beneficiary_id)`.
  5. $\{customer\_id, account\_number, ifsc\_code\} \to beneficiary\_id$: Enforced by Unique Key `uk_ben_account`.
- Every functional dependency is enforced directly by either a `PRIMARY KEY` or a `UNIQUE KEY` constraint on a single relation without requiring cross-table joins during insertion or modification.
- Therefore, the decomposition is **100% Dependency-Preserving**.

---

## 5. Verification Evidence on MySQL 8.0

The normalized schema was executed against MySQL 8.0 via `DBMS_LAB_FINAL.sql` and verified via `scripts/test_college_demo.js`:
1. **Table Count:** Exactly 13 BCNF tables created.
2. **Constraint Enforcement:** Negative deposits rejected by `chk_dep_principal_min` and `chk_dep_maturity_gte_principal`.
3. **Lossless Join Retrieval:** `v_deposits` verified dynamically: `DEP-101` retrieved `customer_id = 'CUST-101'` and `full_name = 'Aarav Patel'` through `accounts`.
4. **Beneficiary Bank Resolution:** `v_beneficiaries` verified dynamically: `BEN-101` retrieved `bank_name = 'Bharat Trust Bank'` through `branches`.
5. **Ledger Parity:** Double-entry conservation confirmed across transfers ($Total\ Liquidity = \text{₹}8,000.00$).
