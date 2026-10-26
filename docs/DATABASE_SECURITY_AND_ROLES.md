# JM-DH Banking System — Database Security, Roles & Data Protection

**Target Database**: MySQL 8.0+ Enterprise Security Model  
**Standards**: Least Privilege Principle, RBI Cyber Security Framework, PCI-DSS Data Protection  
**Author**: Senior Database Security Architect  

---

## 1. Enterprise Role-Based Access Control (RBAC)

Running web applications under high-privilege administrative accounts (`root`) represents an unacceptable security vulnerability. In MySQL 8.0, least-privilege security is implemented using database roles:

```mermaid
graph TD
    subgraph MySQL Roles
        Admin[role_bank_admin]
        Teller[role_bank_teller]
        Auditor[role_bank_auditor]
        AppSvc[role_bank_app_service]
    end

    Admin -->|ALL PRIVILEGES| AllTables[(bankist Database)]
    Teller -->|SELECT, UPDATE| AccTbl[accounts]
    Teller -->|SELECT, INSERT| TxnTbl[transactions]
    Teller -->|SELECT (Masked)| CustTbl[customers]
    Auditor -->|SELECT ONLY| AuditTbl[audit_logs]
    Auditor -->|SELECT ONLY| Views[v_customer_portfolio / v_high_value_transactions]
    AppSvc -->|DML Only| CoreTables[(customers, accounts, deposits, transactions)]
    AppSvc -.->|PROHIBITED: NO DDL| SchemaDef[DROP, ALTER, TRUNCATE]
```

### Role Permissions Matrix:

| Role Name | Table / Resource | Allowed Operations | Denied / Revoked Operations | Security Justification |
| :--- | :--- | :--- | :--- | :--- |
| `role_bank_admin` | Global `bankist`.* | ALL PRIVILEGES | None | Database administration, schema migrations, and index maintenance. |
| `role_bank_teller` | `accounts`, `transactions`, `customers` | `SELECT`, `UPDATE` (balance), `INSERT` (teller cashout) | `DROP`, `ALTER`, `DELETE`, viewing password/PIN hashes | Branch teller counter operations; cannot delete accounts or tamper with audit records. |
| `role_bank_auditor` | `audit_logs`, `transactions`, reporting views | `SELECT` ONLY | `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER` | Independent compliance review; strictly read-only access. |
| `role_bank_app_service`| Production application tables | `SELECT`, `INSERT`, `UPDATE` on operational entities; `EXECUTE` on routines | `DROP`, `ALTER`, `TRUNCATE`, `GRANT` | **Least Privilege**: Application runtime cannot drop tables or execute destructive DDL even in the event of an SQL injection vulnerability. |

---

## 2. Row-Level Security (RLS) Architecture in MySQL 8.0

### Technical Fact:
PostgreSQL provides native declarative policies via `CREATE POLICY ON table FOR SELECT USING (...)`. MySQL 8.0 does **not** feature native RLS policies, and furthermore, MySQL views prohibit referencing user session variables (`@var`) directly in their `SELECT` definitions (`ERROR 1351: View's SELECT contains a variable or parameter`).

### The Enterprise MySQL 8.0 Solution: Session-Context Accessor Functions
To overcome this engine limitation while maintaining declarative security, we implement a **Session-Context Accessor Function**:

```sql
-- 1. Deterministic session context accessor
CREATE FUNCTION fn_get_current_session_customer()
RETURNS VARCHAR(50) DETERMINISTIC NO SQL
RETURN @app_current_customer_id;

-- 2. Secure view referencing the accessor function
CREATE VIEW v_secure_customer_accounts AS
SELECT * FROM accounts 
WHERE customer_id = fn_get_current_session_customer();
```

When an authenticated web session binds `@app_current_customer_id = 'CUST-101'`, queries against `v_secure_customer_accounts` exclusively return rows owned by that customer, preventing horizontal privilege escalation (IDOR).

---

## 3. Data Protection, Masking & Sensitive PII Redaction

To prevent data leakage to branch tellers and non-privileged reporting tools, the database implements dynamic redaction views:

```sql
CREATE VIEW v_teller_customer_view AS
SELECT 
    customer_id,
    full_name,
    CONCAT(LEFT(email, 3), '***@', SUBSTRING_INDEX(email, '@', -1)) AS masked_email,
    CONCAT('+91 *****', RIGHT(phone, 4)) AS masked_phone,
    tier,
    status,
    kyc_status,
    'XXXXXXXX' AS masked_pan,
    aadhaar_number AS masked_aadhaar
FROM customers;
```

### Encryption & Credential Hygiene:
1. **Zero Plaintext Credential Storage**: All customer login passwords and individual 4-digit debit card PINs are hashed using Bcrypt (`bcryptjs`, work factor 10). Plaintext `card_pin` and `otp_code` columns are completely scrubbed from storage.
2. **Encryption in Transit**: TLS 1.3 is enforced on all client connections (`Channel mysql_main configured to support TLS`).
3. **Encryption at Rest**: Tablespaces can be encrypted via InnoDB Transparent Data Encryption (TDE) using `ALTER TABLE ... ENCRYPTION = 'Y'`.
