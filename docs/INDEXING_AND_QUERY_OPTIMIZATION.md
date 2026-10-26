# JM-DH Banking System — Indexing Strategy & Query Optimization Report

**Target Database**: MySQL 8.0+ (InnoDB Storage Engine)  
**Evaluation Tools**: `information_schema.STATISTICS`, `EXPLAIN`, `EXPLAIN ANALYZE` (Tree Execution Engine)  
**Author**: Senior Database Architect & Query Optimization Specialist  

---

## 1. Executive Summary & Principles of Relational Indexing

Indexes in InnoDB are implemented as B+Trees. Every InnoDB table has a **Clustered Index** corresponding to its primary key, where leaf nodes store the actual row data. Secondary indexes store the indexed columns along with the corresponding primary key pointer.

When optimizing high-throughput OLTP banking systems:
1. **Index Selectivity**: Selectivity is defined as $\frac{\text{Count of Distinct Values}}{\text{Total Row Count}}$. High-selectivity columns (e.g., `email`, `account_number`, `reference_number`) are prime index candidates; low-selectivity columns (e.g., `gender`, `status`) should only be indexed when part of a composite index.
2. **Composite Index Column Ordering**: Equality predicate columns must precede range/sort columns to maximize index seek efficiency.
3. **Write Amplification (Overhead)**: Each additional secondary index degrades `INSERT`, `UPDATE`, and `DELETE` performance and consumes buffer pool memory. Every index must be justified by measured query plan evidence.

---

## 2. Production Index Inventory & Rationale

| Table | Index Name | Columns (Order) | Index Type | Business & Query Justification |
| :--- | :--- | :--- | :--- | :--- |
| `accounts` | `PRIMARY` | `account_number` | Clustered B+Tree | Unique account identifier; optimizes point lookups (`O(\log N)`). |
| `accounts` | `idx_acc_cust_status` | `(customer_id, status)` | Composite B+Tree | Accelerates fetching all active accounts for a customer dashboard; satisfies equality filter and status check. |
| `transactions` | `PRIMARY` | `transaction_id` | Clustered B+Tree | Unique ledger transaction key. |
| `transactions` | `idx_tx_sender_datetime` | `(sender_account, date_time)` | Composite B+Tree | **Critical Statement Query**: Eliminates `filesort` when generating customer account statements ordered chronologically. |
| `transactions` | `idx_tx_receiver` | `receiver_account` | Single-column B+Tree | Speeds up credit passbook history for payee accounts. |
| `transactions` | `idx_transactions_reference` | `reference_number` | Unique B+Tree | Enforces UTR idempotency; prevents duplicate transaction ingestion. |
| `deposits` | `idx_dep_maturity_status` | `(status, maturity_date)` | Composite B+Tree | Optimizes batch overnight scheduled events (`WHERE status = 'Active' AND maturity_date <= CURDATE()`). |
| `branches` | `ifsc_code` | `ifsc_code` | Unique B+Tree | Rapid lookups for inter-bank routing and account branch resolution. |

---

## 3. Leftmost-Prefix Rule & Composite Index Mechanics

A composite index on $(A, B)$ is sorted first by $A$, and within identical values of $A$, sorted by $B$.

```
Composite B+Tree Key Structure: (sender_account, date_time)
[ 'ACC-772910' | 2024-06-01 ] ──> Pointer
[ 'ACC-772910' | 2024-06-05 ] ──> Pointer
[ 'ACC-772910' | 2024-06-15 ] ──> Pointer
[ 'ACC-883921' | 2024-01-15 ] ──> Pointer
```

### Empirical Demonstration via `EXPLAIN`:

#### Case A: Both Columns Present (`WHERE sender_account = ? AND date_time > ?`)
- **Execution Plan**:
  ```
  type: range
  key: idx_tx_sender_datetime
  key_len: 209 bytes (203 bytes sender_account + 6 bytes datetime)
  ref: NULL
  rows: 11
  Extra: Using index condition
  ```
- **Finding**: MySQL executes an index range scan utilizing the full composite key.

#### Case B: Leading Column Only (`WHERE sender_account = ?`)
- **Execution Plan**:
  ```
  type: ref
  key: idx_tx_sender
  key_len: 203 bytes
  ref: const
  rows: 11
  ```
- **Finding**: Satisfies the Leftmost Prefix Rule. MySQL performs an index seek on `sender_account`.

#### Case C: Trailing Column Only (`WHERE date_time > ?`)
- **Execution Plan**:
  ```
  type: ALL
  key: NULL
  rows: 27
  Extra: Using where
  ```
- **Finding**: Violates the Leftmost Prefix Rule. The index cannot be used for direct seek because values of `date_time` are scattered across different `sender_account` partitions; MySQL falls back to a Full Table Scan.

---

## 4. Deep Profiling with MySQL 8.0 `EXPLAIN ANALYZE`

`EXPLAIN ANALYZE` executes the query within the MySQL 8.0 iterator executor and returns actual runtime timings, cost estimates, and loop counts:

```
-> Index range scan on transactions using idx_tx_sender_datetime 
   over (sender_account = 'ACC-772910' AND '2024-01-01 00:00:00' <= date_time) (reverse), 
   with index condition: ((transactions.sender_account = 'ACC-772910') and (transactions.date_time >= TIMESTAMP'2024-01-01 00:00:00'))  
   (cost=1.78 rows=11) (actual time=0.0313..0.0723 rows=11 loops=1)
```

### Key Performance Metrics:
- **Index Range Seek Time**: 0.0313 milliseconds to locate first matching leaf tuple.
- **Total Stream Completion**: 0.0723 milliseconds to return all 11 sorted statement records.
- **Estimated Rows vs Actual Rows**: 11 vs 11 ($100\%$ optimizer estimation accuracy).
- **Filesort Overhead**: **Zero**. Ordering was resolved directly from the B+Tree leaf traversal (`(reverse)` backward index scan).
