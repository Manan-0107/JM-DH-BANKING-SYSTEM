# Bharat Trust Bank (BTB) — Core Banking DBMS Project

A database-driven banking web application for academic DBMS demonstration, featuring atomic financial transactions, concurrency safety, row-level authorization, and dual-mode database support.

---

## 📁 Repository Directory Structure & Authoritative Application Root

This repository preserves legacy project iterations while establishing the modern Next.js 14 application as authoritative:

| Directory | Status | Description |
| :--- | :--- | :--- |
| **`DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test/`** | **⭐ AUTHORITATIVE** | **Active Modern Application**: Next.js 14 App Router, dual-engine database adapter (SQLite/MySQL), Tailwind CSS, API endpoints, and verification test suites. |
| `DBMS project/bankist.sql` | Supporting | Production MySQL 8.0 schema and seed DDL script. |
| `DBMS_VIVA_DEMONSTRATION_GUIDE.md` | Documentation | Comprehensive DBMS Viva preparation guide with ER diagrams, 3NF schema, joins, views, and Q&A. |
| `test/` | Legacy Prototype | Earlier Express.js backend prototype (Dhrumil). |
| `og/` | Reference Archive | Original static HTML/CSS/JS frontend mockup (Bankist). |

---

## 🚀 Quick Start (Running the Authoritative App)

### 1. Navigate to Authoritative Project Directory
```bash
cd "DBMS project/JM-DH-BANKING-SYSTEM-main/JM-DH-BANKING-SYSTEM-main/test"
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
By default, `USE_MYSQL=false` uses embedded SQLite (`bankist.sqlite`) with automatic table creation and demo seeding out of the box.

To connect to a live MySQL 8.0 server, update `.env`:
```env
USE_MYSQL=true
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bankist
JWT_SECRET=your_secure_32_byte_secret_here
```

### 3. Install & Start Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Verification Test Suites

### Complete Backend Infrastructure Suite (44 Tests)
Validates authentication, row-level authorization, overdraft prevention, multi-threaded concurrency, atomic transaction rollback, term deposits, and ATM operations:
```bash
node test_backend_suite.js
```

### End-to-End Database Persistence Verification
Verifies that onboarding grants, transfers, and ledger UTR records persist across full server restarts:
```bash
node test_persistence.js
```

### Static Type Check
```bash
npx tsc --noEmit
```

---

## 📚 Viva Preparation
For examiner demonstration questions, ACID transaction code blocks, and relational algebra queries, refer to [`DBMS_VIVA_DEMONSTRATION_GUIDE.md`](./DBMS_VIVA_DEMONSTRATION_GUIDE.md).
