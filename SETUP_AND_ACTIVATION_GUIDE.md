# Bharat Trust Bank (BTB) / Bankist Banking System
## System Setup, Environment Configuration & Server Activation Guide

**Project:** Bharat Trust Bank (BTB) Core Banking Application  
**Engine:** MySQL 8.0.42 Community / Enterprise Server  
**Framework:** Next.js 15.5.28 (React 18.3.1, TypeScript 5.6.3)  
**Author:** Production Deployment Engineer & Full-Stack Developer  
**Status:** PRODUCTION READY

---

## 1. System Requirements & Prerequisites

### 1.1 Software Requirements
- **Operating System:** Windows 10/11, macOS (Sonoma+), or Linux (Ubuntu 20.04+ / Debian 11+)
- **Node.js Runtime:** Node.js v20.x or v22.x LTS (Tested on v20.18.0 & v24.18.0)
- **Package Manager:** npm (v10+) or pnpm (v9+)
- **Database Server:** MySQL Server 8.0.16+ (MySQL 8.0.42 recommended) with InnoDB storage engine

### 1.2 MySQL Server Configuration
Ensure your MySQL server configuration (`my.cnf` or `my.ini`) enables UTF-8 encoding and strict SQL mode:

```ini
[mysqld]
default-storage-engine = InnoDB
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
sql_mode = "ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION"
```

---

## 2. Environment Variables Configuration

Create or verify the `.env` file in the application directory:
`DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/.env`

```env
# ==============================================================================
# BHARAT TRUST BANK (BTB) — ENVIRONMENT CONFIGURATION
# ==============================================================================

# Database Connection (Exclusive MySQL 8.0+ Runtime Engine)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YourSecurePasswordHere
DB_NAME=bankist

# JWT Session & Security
JWT_SECRET=your-256-bit-cryptographic-random-secret-key-here
JWT_EXPIRES_IN=24h

# Application Feature & Security Flags
ALLOW_TEST_OTP=true
ENABLE_DEMO_GRANT=true
ALLOW_SIMULATED_UPI=true

# Administrative Access Configuration (Comma-separated admin emails)
ADMIN_EMAILS=admin@bharatbank.com,admin@btb.internal
```

> [!NOTE]
> In production environments, set `ENABLE_DEMO_GRANT=false` and `ALLOW_SIMULATED_UPI=false`. Test harness endpoints are automatically disabled when `NODE_ENV=production`.

---

## 3. Database Initialization & Normalized Migration

### 3.1 Initializing the Authoritative Normalized Schema
To initialize a clean database instance with the 13 BCNF normalized tables and 6 backward-compatibility views:

```bash
# 1. Create database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bankist_normalized CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Source the authoritative normalized schema DDL
mysql -u root -p bankist_normalized < "DBMS project/bankist_normalized.sql"
```

### 3.2 Executing the Lossless Data Migration
To migrate data losslessly from baseline `bankist` into the normalized database:

```bash
# 3. Source the safe migration script
mysql -u root -p bankist_normalized < "DBMS project/bankist_migration.sql"
```

### 3.3 Running Automated SQL Validation Tests
To run the automated 37-assertion test suite verifying table counts, zero orphans, 100% financial conservation, and strict mode compliance:

```bash
# 4. Source the test assertions
mysql -u root -p bankist_normalized < "DBMS project/bankist_normalization_tests.sql"
```

Alternatively, run the automated end-to-end validation runner from the project root:
```bash
node scripts/execute_normalization_validation.js
```

---

## 4. Application Installation & Server Activation

Navigate to the authoritative application directory:
```bash
cd "DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test"
```

### 4.1 Dependency Installation
```bash
npm install
```

### 4.2 Type-Checking
Verify that TypeScript compiles with zero errors:
```bash
npm run type-check
```

### 4.3 Running in Development Mode
To run the application with hot module reloading and automated testing endpoints enabled:
```bash
npm run dev
```
- **Local URL:** `http://localhost:3000`
- **Output:** `Ready in ~2s`

### 4.4 Compiling & Starting the Production Server
To compile an optimized production build and start the high-performance production server:

```bash
# 1. Compile production build
npm run build

# 2. Start production HTTP server
npm run start
```
- **Local URL:** `http://localhost:3000`
- **Network URL:** `http://<local-ip>:3000`
- **Startup Time:** `Ready in ~400ms`

---

## 5. Verifying Live Server & Operational Endpoints

### 5.1 Root Presentation Pages
Open in any modern web browser or test via curl / PowerShell:
- **Landing Page:** `http://localhost:3000/` (HTTP 200 OK)
- **Net-Banking Portal:** `http://localhost:3000/personal` (HTTP 200 OK)
- **e-KYC Onboarding:** `http://localhost:3000/open-account` (HTTP 200 OK)
- **Database Schema Inspector:** `http://localhost:3000/table-detail` (HTTP 200 OK)

### 5.2 Health & Institutional API Verification
```bash
# Verify branch catalog and deposit interest rates
curl -s http://localhost:3000/api/institutional
```
Expected response:
```json
{
  "branches": [ ... 8 branches ... ],
  "deposit_rates": [ ... 8 tiers ... ],
  "disclaimer": "Institutional directory data served directly from relational database."
}
```

---

## 6. Running Automated Regression Test Suites

From the application root (`DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test`):

```bash
# 1. Run Core Banking Infrastructure Suite (161 assertions)
npm run test:backend

# 2. Run MySQL Exclusive Runtime Enforcement Suite (20 assertions)
npm run test:engine

# 3. Run End-to-End Persistence Suite
npm run test:persistence

# 4. Run Security Lockout & Brute-Force Suite (42 assertions)
node test_security_remediation.js

# 5. Run Isolated Multi-Module Security Suite (6 suites)
node test_security_phase_verification.js
```

From the project root:
```bash
# 6. Run 37-Assertion Normalization Integrity Runner
node scripts/execute_normalization_validation.js

# 7. Run Real Next.js Application Compatibility Suite
node scripts/test_app_compatibility_on_disposable_db.js
```

---

## 7. Troubleshooting & FAQs

### Q1: `ER_ACCESS_DENIED_ERROR` when connecting to MySQL
- **Cause:** Incorrect username or password in `.env`.
- **Solution:** Verify `DB_USER` and `DB_PASSWORD` in `test/.env` match your local MySQL root credentials.

### Q2: Port 3000 Already in Use (`EADDRINUSE`)
- **Cause:** Another process or development server is already bound to port 3000.
- **Solution:** In PowerShell, find and terminate the process:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
  ```

### Q3: Why does `/api/system/test-rollback` return HTTP 404 in production?
- **Cause:** Intentional security gating. Internal test rollback endpoints are disabled when `NODE_ENV=production` to prevent unauthorized execution in production.
- **Solution:** This is the expected and documented security behavior. Use `npm run dev` for running internal test harness endpoints.

