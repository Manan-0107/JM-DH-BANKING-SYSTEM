# Bharat Trust Bank (BTB) — DBMS Normalization & Lab Demonstration Guide
## How to Run `DBMS_LAB_FINAL.sql` and Validate BCNF in MySQL Workbench

This guide provides step-by-step instructions for running the authoritative DBMS laboratory submission script (`DBMS_LAB_FINAL.sql`) and testing the normalized schema (`bankist_normalized.sql`) in **MySQL Workbench** or from the **MySQL Command-Line Client (CLI)**.

---

## 1. Prerequisites

- **MySQL Server:** Version 8.0.16 or higher (InnoDB engine, strict mode enabled).
- **MySQL Workbench:** Version 8.0.x (or MySQL CLI / phpMyAdmin / DBeaver).
- **Node.js (Optional, for automated runners):** Version 18.x or higher.

---

## 2. Authoritative SQL Files Summary

| File Path | Description | Recommended Usage |
|---|---|---|
| **`DBMS_LAB_FINAL.sql`** | **Complete Self-Contained College Lab Script.** Creates `bankist_college_demo`, builds all 13 BCNF tables, 8 views, 2 stored procedures, demo seed data, and executes all 7 live test scenarios. | **Primary submission script for examiners and viva demonstrations.** |
| **`bankist_normalized.sql`** | Pure DDL schema containing all 13 BCNF base tables and 8 views without test scenarios. | Production/staging DDL reference. |
| **`bankist_migration.sql`** | Non-destructive data migration script from source database. | Staging database migration. |
| **`bankist_normalization_tests.sql`** | Comprehensive 42-assertion automated SQL verification test suite. | Automated integrity testing. |

> [!IMPORTANT]
> **Live Database Protection Guard:**  
> `DBMS_LAB_FINAL.sql` includes an automated pre-flight security guard (`sp_assert_safe_demo_db`). If executed by mistake against the live production database `bankist`, the script will immediately throw an exception (`SIGNAL SQLSTATE '45000'`) and halt execution before modifying any data.

---

## 3. How to Run in MySQL Workbench (Step-by-Step)

### Step 1: Open MySQL Workbench
Launch **MySQL Workbench** and connect to your local MySQL 8.0 server instance (e.g., `Local instance MySQL80` at `127.0.0.1:3306`).

### Step 2: Open the Lab Script
1. Click **File** $\to$ **Open SQL Script...** (or press `Ctrl + Shift + O`).
2. Navigate to the project folder and select:
   ```
   DBMS_LAB_FINAL.sql
   ```
   *(Or navigate into `DBMS project/DBMS_LAB_FINAL.sql`)*.

### Step 3: Execute the Entire Script
1. Click the **Execute** icon (the yellow lightning bolt ⚡ without cursor) on the SQL editor toolbar, or press `Ctrl + Shift + Enter`.
2. The script will execute sequentially from line 1 to the end:
   - Sets safe SQL modes (`NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES`).
   - Ensures target schema `bankist_college_demo` exists and selects it (`USE bankist_college_demo;`).
   - Creates all 13 BCNF base tables and indexes.
   - Deploys stored procedures `sp_deposit_funds` and `sp_transfer_funds`.
   - Populates initial demonstration accounts (`ACC-1001` for Aarav Patel, `ACC-1002` for Priya Nair).
   - Executes and outputs results for all 7 lab demonstration scenarios.

### Step 4: Inspect the Output Grids
Look at the **Result Grid** tabs at the bottom of MySQL Workbench:
- **Result 1:** Baseline balances (`ACC-1001`: ₹5,000.00, `ACC-1002`: ₹2,000.00).
- **Result 2 & 3:** Deposit of ₹1,000.00 into `ACC-1001` $\to$ New balance ₹6,000.00, transaction ledger record generated.
- **Result 4 & 5:** Transfer of ₹500.00 from `ACC-1001` to `ACC-1002` $\to$ Sender: ₹5,500.00, Receiver: ₹2,500.00. Institutional liquidity conserved at ₹8,000.00.
- **Result 6:** Rejection of negative deposit (₹-500.00) $\to$ Status `REJECTED`.
- **Result 7:** Rejection of overdraft transfer (₹10,000.00) $\to$ Status `REJECTED`.
- **Result 8:** Demonstration of ACID atomicity: caught error triggers rollback, balance restored.
- **Result 9 - 14:** Execution of all 8 canonical views (`v_customer_portfolio`, `v_customers_legacy`, `v_deposits`, `v_beneficiaries`, etc.).

---

## 4. How to Run from MySQL Command-Line Client (CLI)

Open PowerShell or Command Prompt:

### 1. Execute `DBMS_LAB_FINAL.sql`
```powershell
mysql -u root -p < "c:\Users\MANAN\OneDrive\Desktop\SQL PROJECT\DBMS_LAB_FINAL.sql"
```
*(Enter your MySQL root password when prompted)*.

### 2. Verify Result Output
You will see all banners, ledger confirmations, balance updates, and view grids printed directly to the terminal.

### 3. Run the 42-Assertion Test Suite
```powershell
mysql -u root -p bankist_college_demo < "c:\Users\MANAN\OneDrive\Desktop\SQL PROJECT\bankist_normalization_tests.sql"
```

---

## 5. Automated Node.js Test Runners

You can also run the complete automated test harness from the command line:

```powershell
# 1. Run full normalization validation (42 assertions with pre/post live DB fingerprint check)
node scripts/execute_normalization_validation.js

# 2. Run clean disposable setup & isolation test (18 assertions)
node scripts/test_disposable_setup_isolation.js

# 3. Run college demo test (Part 1 SQL + Part 2 Next.js API)
node scripts/test_college_demo.js
```

---

## 6. Viva Demonstration Cheatsheet (Examiner Q&A)

### Q1: Why is this schema in Boyce-Codd Normal Form (BCNF)?
> **Answer:** In every base relation, for every non-trivial functional dependency $X \to Y$, the determinant $X$ is a **superkey** (candidate key). For example, in `accounts`, branch name was transitively dependent on `ifsc_code` rather than `account_number`, so it was decomposed into `branches`. In `deposits`, customer details were transitively dependent on `linked_account`, so `customer_id` was eliminated and is resolved dynamically via `accounts`.

### Q2: How do you prove the decomposition was lossless?
> **Answer:** According to Heath's Theorem, a decomposition into $R_1$ and $R_2$ is lossless if $R_1 \cap R_2$ is a candidate key of $R_1$ or $R_2$. For instance:
> - $\text{accounts} \cap \text{branches} = \{\text{ifsc\_code}\}$, which is a declared candidate key (`UNIQUE KEY`) in `branches`.
> - $\text{customers} \cap \text{customer\_nominees} = \{\text{customer\_id}\}$, which is the primary key in `customers`.
> Therefore, natural joins reconstruct the original relations without introducing spurious tuples.

### Q3: Why is `(customer_id, nominee_name)` not declared as a UNIQUE key?
> **Answer:** A person's name is not mathematically or contractually unique. A customer may appoint two family members who share a given name. The only candidate key is `{nominee_id}`.

### Q4: How is ACID transaction atomicity handled?
> **Answer:** All fund transfers use MySQL stored procedures (`sp_transfer_funds`) wrapped in `START TRANSACTION ... COMMIT` blocks with `DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; END;`. If any step fails (e.g., negative balance check constraint or network failure), all updates are atomically rolled back.

