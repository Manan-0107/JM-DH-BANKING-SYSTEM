# JM-DH Banking System — ACID Properties, Concurrency & Locking Architecture

**Target Database**: MySQL 8.0+ (InnoDB Storage Engine)  
**Standard**: ISO/IEC SQL Transaction Model  
**Author**: Senior Database Architect & Concurrency Specialist  

---

## 1. The ACID Paradigm in Financial Core Banking

In financial database architecture, correctness is non-negotiable. Every state transition must satisfy the four pillars of ACID:

### 1.1 Atomicity (All-or-Nothing Execution)
- **Concept**: A transaction comprises multiple physical operations (e.g., debit source account, credit destination account, record ledger entry, update audit log). If any individual step fails or an unexpected exception occurs, all changes made within that transaction must be completely undid (**ROLLBACK**).
- **Implementation**:
  - Implemented in `sp_atomic_fund_transfer` and `lib/db.ts` using `START TRANSACTION`, `COMMIT`, and `ROLLBACK`.
  - Savepoints (`SAVEPOINT sp_name` ... `ROLLBACK TO SAVEPOINT sp_name`) allow granular recovery from intermediate non-fatal business errors without abandoning the parent transaction.
- **Verification Evidence**: Deliberate mid-transaction failure injection proved that account balances and transaction count before failure identically match states after failure ($0.00$ partial leakage).

### 1.2 Consistency (Preservation of Financial Invariants)
- **Concept**: A transaction transforms the database from one valid consistent state to another valid state, preserving all integrity constraints and business invariants.
- **Banking Invariant**:
  $$\sum \text{Debit Amounts} = \sum \text{Credit Amounts}$$
  $$\forall \text{account } a \in \text{ACCOUNTS}, \quad a.\text{balance} \ge 0.00$$
- **Enforcement Mechanisms**:
  - Declarative `CHECK` constraint: `chk_account_positive_balance` (`balance >= 0.00`).
  - Defensive trigger: `trg_prevent_negative_balance` throwing `SQLSTATE '45000'`.
  - Referential integrity: `FOREIGN KEY ... ON DELETE CASCADE` / `ON DELETE RESTRICT`.

### 1.3 Isolation (Concurrency Independence via MVCC)
- **Concept**: Concurrent transactions execute as if they were running serially without observing intermediate, uncommitted changes made by other concurrent transactions.
- **MySQL InnoDB Storage Engine Default**: `REPEATABLE READ`.
- **Multi-Version Concurrency Control (MVCC)**:
  - InnoDB creates a **Read View** at the start of each consistent read statement (in `READ COMMITTED`) or at the start of the first read query in a transaction (in `REPEATABLE READ`).
  - Undo logs (`rollback segment`) reconstruct historical versions of tuples based on transaction IDs (`DB_TRX_ID` and `DB_ROLL_PTR`).
  - Read queries never wait for write locks; write queries never block consistent read queries.

### 1.4 Durability (Non-Volatile Persistence)
- **Concept**: Once a transaction is committed, its modifications survive any subsequent system crash, power loss, or operating system failure.
- **InnoDB Engine Mechanics**:
  - **Write-Ahead Logging (WAL)**: Modified pages are written to the in-memory buffer pool and simultaneously flushed to the disk-based **Redo Log** (`ib_logfile0`).
  - Even if modified buffer pages have not yet been flushed to tablespace `.ibd` files during a crash, InnoDB applies redo log records upon restart (**Crash Recovery / Roll-Forward Phase**).
  - Uncommitted transactions are identified and rolled back using undo log records (**Undo Phase**).

---

## 2. Transaction Isolation Levels & Classical Concurrency Phenomena

| Isolation Level | Dirty Read ($\mathbf{G_1}$) | Non-Repeatable Read ($\mathbf{G_2}$) | Phantom Read ($\mathbf{A3}$) | Lost Update ($\mathbf{P_4}$) |
| :--- | :---: | :---: | :---: | :---: |
| **READ UNCOMMITTED** | Permitted | Permitted | Permitted | High Risk |
| **READ COMMITTED** | Prevented | Permitted | Permitted | Prevented with Row Locks |
| **REPEATABLE READ (MySQL Default)** | **Prevented** | **Prevented** | **Prevented via Next-Key Locks** | **Prevented with Row Locks** |
| **SERIALIZABLE** | Prevented | Prevented | Prevented | Prevented |

### Anatomy of Concurrency Phenomena:
1. **Dirty Read**: Transaction $T_2$ reads uncommitted modifications made by $T_1$. If $T_1$ rolls back, $T_2$ has acted upon phantom non-existent financial data.
2. **Non-Repeatable Read**: $T_1$ reads row $R$. $T_2$ updates $R$ and commits. $T_1$ re-reads $R$ within the same transaction and observes a mutated value. Prevented in InnoDB `REPEATABLE READ` via consistent snapshot read views.
3. **Phantom Read**: $T_1$ executes a range query (`WHERE balance > 50000`). $T_2$ inserts a new row matching that predicate and commits. $T_1$ re-executes the range query and discovers an extra row. Prevented in InnoDB using **Next-Key Locks** (combination of record locks and gap locks).

---

## 3. Concurrency Protection & Row-Level Locking

### The Lost-Update Problem in Retail Banking:
Consider two concurrent requests ($T_1$ and $T_2$) attempting to withdraw funds from Account $A$ (initial balance: ₹1,000):
```
T1: Read Balance (1000)
T2: Read Balance (1000)
T1: Deduct 600, Write Balance (400)
T2: Deduct 500, Write Balance (500)  <-- LOST UPDATE! Account allowed 1100 total spend on 1000 balance!
```

### The Solution: Pessimistic Row Locking via `SELECT ... FOR UPDATE`
```sql
SELECT balance FROM accounts WHERE account_number = ? FOR UPDATE;
```
When $T_1$ executes `FOR UPDATE`, InnoDB acquires an **Exclusive Lock (X-Lock)** on the clustered index record. $T_2$ is blocked at the database engine level until $T_1$ issues `COMMIT` or `ROLLBACK`. $T_2$ then re-reads the fresh, committed balance (₹400) and correctly rejects the second withdrawal due to insufficient funds.

---

## 4. Deadlock Detection & The Canonical Sorting Rule

A deadlock occurs when two transactions hold locks and each waits for the lock held by the other:
- $T_1$ locks Account $A$ and requests a lock on Account $B$.
- $T_2$ locks Account $B$ and requests a lock on Account $A$.

### Resolution Strategy: Canonical Lock Ordering
By enforcing a strict lexicographical ordering on locked resources:
```sql
IF p_acc_from < p_acc_to THEN
    SET v_first = p_acc_from, v_second = p_acc_to;
ELSE
    SET v_first = p_acc_to, v_second = p_acc_from;
END IF;

-- Always acquire locks in uniform order across all threads:
SELECT balance FROM accounts WHERE account_number = v_first FOR UPDATE;
SELECT balance FROM accounts WHERE account_number = v_second FOR UPDATE;
```
Because all concurrent transactions request locks in the exact same sequence ($v_{\text{first}} \to v_{\text{second}}$), a circular wait condition is mathematically impossible, eliminating deadlocks entirely.
