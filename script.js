'use strict';

// ============================================================
// BANKING DBMS PROJECT — JAVASCRIPT
// Extended from original Bankist JS.
// Preserves: modal, scroll, event listeners.
// Adds: sample data, tab switching, slider, query lab,
//       dynamic forms, schema interaction, API stubs.
// ============================================================

// ============================================================
// 1. SAMPLE DATA STORE
//    All data respects FK relationships. No orphan records.
//    Ready for backend replacement via API stubs (Section 14).
// ============================================================
const sampleData = {
  branch: [
    { branch_id: 1, branch_name: 'Mumbai Main', branch_address: '123 Marine Drive, Mumbai', assets: 50000000.00 },
    { branch_id: 2, branch_name: 'Delhi Central', branch_address: '45 Connaught Place, Delhi', assets: 42000000.00 },
    { branch_id: 3, branch_name: 'Bangalore Tech Park', branch_address: '78 Whitefield Road, Bangalore', assets: 38000000.00 },
    { branch_id: 4, branch_name: 'Chennai Anna Nagar', branch_address: '12 Anna Salai, Chennai', assets: 31000000.00 },
    { branch_id: 5, branch_name: 'Pune Koregaon', branch_address: '90 Koregaon Park, Pune', assets: 27000000.00 },
  ],
  banker: [
    { banker_id: 1, banker_name: 'Rajesh Kumar', branch_id: 1 },
    { banker_id: 2, banker_name: 'Priya Sharma', branch_id: 1 },
    { banker_id: 3, banker_name: 'Amit Patel', branch_id: 2 },
    { banker_id: 4, banker_name: 'Sneha Gupta', branch_id: 3 },
    { banker_id: 5, banker_name: 'Vikram Singh', branch_id: 4 },
    { banker_id: 6, banker_name: 'Neha Desai', branch_id: 5 },
    { banker_id: 7, banker_name: 'Rohit Mehta', branch_id: 2 },
    { banker_id: 8, banker_name: 'Kavita Rao', branch_id: 3 },
  ],
  account: [
    { account_id: 101, account_balance: 45000.00, account_type: 'Savings', branch_id: 1 },
    { account_id: 102, account_balance: 120000.00, account_type: 'Current', branch_id: 1 },
    { account_id: 103, account_balance: 78000.00, account_type: 'Savings', branch_id: 2 },
    { account_id: 104, account_balance: 250000.00, account_type: 'Fixed Deposit', branch_id: 2 },
    { account_id: 105, account_balance: 33000.00, account_type: 'Savings', branch_id: 3 },
    { account_id: 106, account_balance: 95000.00, account_type: 'Current', branch_id: 3 },
    { account_id: 107, account_balance: 15000.00, account_type: 'Savings', branch_id: 4 },
    { account_id: 108, account_balance: 180000.00, account_type: 'Fixed Deposit', branch_id: 4 },
    { account_id: 109, account_balance: 62000.00, account_type: 'Savings', branch_id: 5 },
    { account_id: 110, account_balance: 410000.00, account_type: 'Current', branch_id: 5 },
  ],
  customer: [
    { customer_id: 1, customer_name: 'Aarav Sharma', dob: '1995-03-15', mobileno: '9876543210', account_id: 101 },
    { customer_id: 2, customer_name: 'Meera Patel', dob: '1990-07-22', mobileno: '9876543211', account_id: 102 },
    { customer_id: 3, customer_name: 'Rohan Gupta', dob: '1988-11-30', mobileno: '9876543212', account_id: 103 },
    { customer_id: 4, customer_name: 'Ananya Singh', dob: '1993-01-08', mobileno: '9876543213', account_id: 104 },
    { customer_id: 5, customer_name: 'Vikash Kumar', dob: '1985-05-17', mobileno: '9876543214', account_id: 105 },
    { customer_id: 6, customer_name: 'Pooja Reddy', dob: '1997-09-25', mobileno: '9876543215', account_id: 106 },
    { customer_id: 7, customer_name: 'Karthik Nair', dob: '1992-12-03', mobileno: '9876543216', account_id: 107 },
    { customer_id: 8, customer_name: 'Divya Iyer', dob: '1991-06-14', mobileno: '9876543217', account_id: 108 },
    { customer_id: 9, customer_name: 'Arjun Menon', dob: '1994-02-28', mobileno: '9876543218', account_id: 109 },
    { customer_id: 10, customer_name: 'Shreya Das', dob: '1996-08-10', mobileno: '9876543219', account_id: 110 },
  ],
  loan: [
    { loan_id: 501, issued_amount: 500000.00, remaining_amount: 350000.00, branch_id: 1, account_id: 101 },
    { loan_id: 502, issued_amount: 1000000.00, remaining_amount: 800000.00, branch_id: 1, account_id: 102 },
    { loan_id: 503, issued_amount: 300000.00, remaining_amount: 150000.00, branch_id: 2, account_id: 103 },
    { loan_id: 504, issued_amount: 750000.00, remaining_amount: 600000.00, branch_id: 3, account_id: 105 },
    { loan_id: 505, issued_amount: 200000.00, remaining_amount: 50000.00, branch_id: 4, account_id: 107 },
    { loan_id: 506, issued_amount: 1500000.00, remaining_amount: 1200000.00, branch_id: 5, account_id: 110 },
  ],
  loan_payment: [
    { loan_payment_id: 1001, loan_id: 501, amount: 50000.00 },
    { loan_payment_id: 1002, loan_id: 501, amount: 50000.00 },
    { loan_payment_id: 1003, loan_id: 501, amount: 50000.00 },
    { loan_payment_id: 1004, loan_id: 502, amount: 100000.00 },
    { loan_payment_id: 1005, loan_id: 502, amount: 100000.00 },
    { loan_payment_id: 1006, loan_id: 503, amount: 75000.00 },
    { loan_payment_id: 1007, loan_id: 503, amount: 75000.00 },
    { loan_payment_id: 1008, loan_id: 504, amount: 150000.00 },
    { loan_payment_id: 1009, loan_id: 505, amount: 75000.00 },
    { loan_payment_id: 1010, loan_id: 505, amount: 75000.00 },
    { loan_payment_id: 1011, loan_id: 506, amount: 150000.00 },
    { loan_payment_id: 1012, loan_id: 506, amount: 150000.00 },
  ],
  borrower: [
    { borrower_id: 201, loan_id: 501, customer_id: 1 },
    { borrower_id: 202, loan_id: 502, customer_id: 2 },
    { borrower_id: 203, loan_id: 503, customer_id: 3 },
    { borrower_id: 204, loan_id: 504, customer_id: 5 },
    { borrower_id: 205, loan_id: 505, customer_id: 7 },
    { borrower_id: 206, loan_id: 506, customer_id: 10 },
  ],
  transaction: [
    { transaction_id: 301, account_id: 101, customer_id: 1, amount: 5000.00 },
    { transaction_id: 302, account_id: 101, customer_id: 1, amount: 12000.00 },
    { transaction_id: 303, account_id: 102, customer_id: 2, amount: 25000.00 },
    { transaction_id: 304, account_id: 103, customer_id: 3, amount: 8000.00 },
    { transaction_id: 305, account_id: 104, customer_id: 4, amount: 50000.00 },
    { transaction_id: 306, account_id: 105, customer_id: 5, amount: 3000.00 },
    { transaction_id: 307, account_id: 106, customer_id: 6, amount: 15000.00 },
    { transaction_id: 308, account_id: 107, customer_id: 7, amount: 7500.00 },
    { transaction_id: 309, account_id: 108, customer_id: 8, amount: 30000.00 },
    { transaction_id: 310, account_id: 109, customer_id: 9, amount: 4500.00 },
    { transaction_id: 311, account_id: 110, customer_id: 10, amount: 100000.00 },
    { transaction_id: 312, account_id: 101, customer_id: 1, amount: 2000.00 },
  ],
  credit_card: [
    { credit_card_id: 4001, expiry_date: '2028-06-30', card_limit: 100000.00, account_id: 101, customer_id: 1 },
    { credit_card_id: 4002, expiry_date: '2029-03-31', card_limit: 250000.00, account_id: 102, customer_id: 2 },
    { credit_card_id: 4003, expiry_date: '2027-12-31', card_limit: 150000.00, account_id: 103, customer_id: 3 },
    { credit_card_id: 4004, expiry_date: '2028-09-30', card_limit: 500000.00, account_id: 104, customer_id: 4 },
    { credit_card_id: 4005, expiry_date: '2029-01-31', card_limit: 75000.00, account_id: 106, customer_id: 6 },
    { credit_card_id: 4006, expiry_date: '2028-11-30', card_limit: 200000.00, account_id: 108, customer_id: 8 },
    { credit_card_id: 4007, expiry_date: '2029-07-31', card_limit: 300000.00, account_id: 110, customer_id: 10 },
  ],
};

// ============================================================
// 2. TABLE METADATA (Schema source of truth)
// ============================================================
const tableMetadata = {
  branch: {
    displayName: 'Branch',
    primaryKey: 'branch_id',
    attributes: ['branch_id', 'branch_name', 'branch_address', 'assets'],
    foreignKeys: [],
    constraints: [
      'PRIMARY KEY (branch_id)',
      'NOT NULL: branch_name, branch_address',
      'CHECK: assets >= 0',
    ],
    relationships: [
      'Banker belongs to Branch via branch_id',
      'Account belongs to Branch via branch_id',
      'Loan belongs to Branch via branch_id',
    ],
    fieldTypes: {
      branch_id: 'number', branch_name: 'text', branch_address: 'text', assets: 'number',
    },
  },
  banker: {
    displayName: 'Banker',
    primaryKey: 'banker_id',
    attributes: ['banker_id', 'banker_name', 'branch_id'],
    foreignKeys: [{ field: 'branch_id', references: 'Branch(branch_id)' }],
    constraints: [
      'PRIMARY KEY (banker_id)',
      'NOT NULL: banker_name',
      'FOREIGN KEY: branch_id → Branch(branch_id)',
    ],
    relationships: ['Banker is associated with Branch through branch_id'],
    fieldTypes: { banker_id: 'number', banker_name: 'text', branch_id: 'fk-branch' },
  },
  account: {
    displayName: 'Account',
    primaryKey: 'account_id',
    attributes: ['account_id', 'account_balance', 'account_type', 'branch_id'],
    foreignKeys: [{ field: 'branch_id', references: 'Branch(branch_id)' }],
    constraints: [
      'PRIMARY KEY (account_id)',
      'CHECK: account_balance >= 0',
      "CHECK: account_type IN ('Savings', 'Current', 'Fixed Deposit')",
      'FOREIGN KEY: branch_id → Branch(branch_id)',
    ],
    relationships: [
      'Account belongs to Branch via branch_id',
      'Customer references Account via account_id',
      'Transaction references Account via account_id',
      'Credit Card references Account via account_id',
      'Loan references Account via account_id',
    ],
    fieldTypes: {
      account_id: 'number', account_balance: 'number', account_type: 'select-account_type', branch_id: 'fk-branch',
    },
  },
  customer: {
    displayName: 'Customer',
    primaryKey: 'customer_id',
    attributes: ['customer_id', 'customer_name', 'dob', 'mobileno', 'account_id'],
    foreignKeys: [{ field: 'account_id', references: 'Account(account_id)' }],
    constraints: [
      'PRIMARY KEY (customer_id)',
      'NOT NULL: customer_name, mobileno',
      'UNIQUE: mobileno',
      'FOREIGN KEY: account_id → Account(account_id)',
    ],
    relationships: [
      'Customer is associated with Account via account_id',
      'Borrower references Customer via customer_id',
      'Transaction references Customer via customer_id',
      'Credit Card references Customer via customer_id',
    ],
    fieldTypes: {
      customer_id: 'number', customer_name: 'text', dob: 'date', mobileno: 'tel', account_id: 'fk-account',
    },
  },
  loan: {
    displayName: 'Loan',
    primaryKey: 'loan_id',
    attributes: ['loan_id', 'issued_amount', 'remaining_amount', 'branch_id', 'account_id'],
    foreignKeys: [
      { field: 'branch_id', references: 'Branch(branch_id)' },
      { field: 'account_id', references: 'Account(account_id)' },
    ],
    constraints: [
      'PRIMARY KEY (loan_id)',
      'NOT NULL: issued_amount, remaining_amount',
      'CHECK: issued_amount > 0',
      'CHECK: remaining_amount >= 0',
      'FOREIGN KEY: branch_id → Branch(branch_id)',
      'FOREIGN KEY: account_id → Account(account_id)',
    ],
    relationships: [
      'Loan belongs to Branch via branch_id',
      'Loan is associated with Account via account_id',
      'Loan Payment references Loan via loan_id',
      'Borrower references Loan via loan_id',
    ],
    fieldTypes: {
      loan_id: 'number', issued_amount: 'number', remaining_amount: 'number', branch_id: 'fk-branch', account_id: 'fk-account',
    },
  },
  loan_payment: {
    displayName: 'Loan Payment',
    primaryKey: 'loan_payment_id',
    attributes: ['loan_payment_id', 'loan_id', 'amount'],
    foreignKeys: [{ field: 'loan_id', references: 'Loan(loan_id)' }],
    constraints: [
      'PRIMARY KEY (loan_payment_id)',
      'CHECK: amount > 0',
      'FOREIGN KEY: loan_id → Loan(loan_id)',
    ],
    relationships: ['Loan Payment belongs to Loan via loan_id'],
    fieldTypes: { loan_payment_id: 'number', loan_id: 'fk-loan', amount: 'number' },
  },
  borrower: {
    displayName: 'Borrower',
    primaryKey: 'borrower_id',
    attributes: ['borrower_id', 'loan_id', 'customer_id'],
    foreignKeys: [
      { field: 'loan_id', references: 'Loan(loan_id)' },
      { field: 'customer_id', references: 'Customer(customer_id)' },
    ],
    constraints: [
      'PRIMARY KEY (borrower_id)',
      'FOREIGN KEY: loan_id → Loan(loan_id)',
      'FOREIGN KEY: customer_id → Customer(customer_id)',
    ],
    relationships: [
      'Borrower connects Loan and Customer',
      'Borrower references Loan via loan_id',
      'Borrower references Customer via customer_id',
    ],
    fieldTypes: { borrower_id: 'number', loan_id: 'fk-loan', customer_id: 'fk-customer' },
  },
  transaction: {
    displayName: 'Transaction',
    primaryKey: 'transaction_id',
    attributes: ['transaction_id', 'account_id', 'customer_id', 'amount'],
    foreignKeys: [
      { field: 'account_id', references: 'Account(account_id)' },
      { field: 'customer_id', references: 'Customer(customer_id)' },
    ],
    constraints: [
      'PRIMARY KEY (transaction_id)',
      'CHECK: amount > 0',
      'FOREIGN KEY: account_id → Account(account_id)',
      'FOREIGN KEY: customer_id → Customer(customer_id)',
    ],
    relationships: [
      'Transaction references Account via account_id',
      'Transaction references Customer via customer_id',
    ],
    fieldTypes: { transaction_id: 'number', account_id: 'fk-account', customer_id: 'fk-customer', amount: 'number' },
  },
  credit_card: {
    displayName: 'Credit Card',
    primaryKey: 'credit_card_id',
    attributes: ['credit_card_id', 'expiry_date', 'card_limit', 'account_id', 'customer_id'],
    foreignKeys: [
      { field: 'account_id', references: 'Account(account_id)' },
      { field: 'customer_id', references: 'Customer(customer_id)' },
    ],
    constraints: [
      'PRIMARY KEY (credit_card_id)',
      'NOT NULL: expiry_date, card_limit',
      'UNIQUE: credit_card_id',
      'CHECK: card_limit > 0',
      'FOREIGN KEY: account_id → Account(account_id)',
      'FOREIGN KEY: customer_id → Customer(customer_id)',
    ],
    relationships: [
      'Credit Card references Account via account_id',
      'Credit Card references Customer via customer_id',
    ],
    fieldTypes: {
      credit_card_id: 'number', expiry_date: 'date', card_limit: 'number', account_id: 'fk-account', customer_id: 'fk-customer',
    },
  },
};

// ============================================================
// 3. QUERY LAB DATA
//    Organized by category. Each query has: title, sql, result (mock).
//    Results use actual sample data relationships.
// ============================================================
const queryLabData = {
  joins: [
    {
      title: 'INNER JOIN — Banker + Branch',
      sql: `SELECT b.banker_id, b.banker_name, br.branch_name
FROM Banker b
INNER JOIN Branch br ON b.branch_id = br.branch_id;`,
      columns: ['banker_id', 'banker_name', 'branch_name'],
      rows: [
        [1, 'Rajesh Kumar', 'Mumbai Main'], [2, 'Priya Sharma', 'Mumbai Main'],
        [3, 'Amit Patel', 'Delhi Central'], [7, 'Rohit Mehta', 'Delhi Central'],
        [4, 'Sneha Gupta', 'Bangalore Tech Park'], [8, 'Kavita Rao', 'Bangalore Tech Park'],
        [5, 'Vikram Singh', 'Chennai Anna Nagar'], [6, 'Neha Desai', 'Pune Koregaon'],
      ],
    },
    {
      title: 'LEFT JOIN — Branch + Account (account counts)',
      sql: `SELECT br.branch_name, COUNT(a.account_id) AS num_accounts
FROM Branch br
LEFT JOIN Account a ON br.branch_id = a.branch_id
GROUP BY br.branch_name;`,
      columns: ['branch_name', 'num_accounts'],
      rows: [
        ['Mumbai Main', 2], ['Delhi Central', 2], ['Bangalore Tech Park', 2],
        ['Chennai Anna Nagar', 2], ['Pune Koregaon', 2],
      ],
    },
    {
      title: 'JOIN — Loan + Loan Payment',
      sql: `SELECT l.loan_id, l.issued_amount, lp.loan_payment_id, lp.amount AS payment_amount
FROM Loan l
JOIN Loan_Payment lp ON l.loan_id = lp.loan_id
ORDER BY l.loan_id, lp.loan_payment_id;`,
      columns: ['loan_id', 'issued_amount', 'loan_payment_id', 'payment_amount'],
      rows: [
        [501, 500000, 1001, 50000], [501, 500000, 1002, 50000], [501, 500000, 1003, 50000],
        [502, 1000000, 1004, 100000], [502, 1000000, 1005, 100000],
        [503, 300000, 1006, 75000], [503, 300000, 1007, 75000],
      ],
    },
    {
      title: 'JOIN — Loan + Borrower + Customer',
      sql: `SELECT l.loan_id, l.issued_amount, c.customer_name
FROM Loan l
JOIN Borrower b ON l.loan_id = b.loan_id
JOIN Customer c ON b.customer_id = c.customer_id;`,
      columns: ['loan_id', 'issued_amount', 'customer_name'],
      rows: [
        [501, 500000, 'Aarav Sharma'], [502, 1000000, 'Meera Patel'],
        [503, 300000, 'Rohan Gupta'], [504, 750000, 'Vikash Kumar'],
        [505, 200000, 'Karthik Nair'], [506, 1500000, 'Shreya Das'],
      ],
    },
    {
      title: 'JOIN — Account + Customer + Transaction',
      sql: `SELECT c.customer_name, a.account_type, t.transaction_id, t.amount
FROM Customer c
JOIN Account a ON c.account_id = a.account_id
JOIN Transaction t ON t.account_id = a.account_id
  AND t.customer_id = c.customer_id
ORDER BY c.customer_name;`,
      columns: ['customer_name', 'account_type', 'transaction_id', 'amount'],
      rows: [
        ['Aarav Sharma', 'Savings', 301, 5000], ['Aarav Sharma', 'Savings', 302, 12000],
        ['Aarav Sharma', 'Savings', 312, 2000], ['Meera Patel', 'Current', 303, 25000],
        ['Rohan Gupta', 'Savings', 304, 8000], ['Ananya Singh', 'Fixed Deposit', 305, 50000],
      ],
    },
    {
      title: 'JOIN — Account + Credit Card + Customer',
      sql: `SELECT c.customer_name, cc.credit_card_id, cc.card_limit,
       a.account_type, cc.expiry_date
FROM Credit_Card cc
JOIN Account a ON cc.account_id = a.account_id
JOIN Customer c ON cc.customer_id = c.customer_id;`,
      columns: ['customer_name', 'credit_card_id', 'card_limit', 'account_type', 'expiry_date'],
      rows: [
        ['Aarav Sharma', 4001, 100000, 'Savings', '2028-06-30'],
        ['Meera Patel', 4002, 250000, 'Current', '2029-03-31'],
        ['Rohan Gupta', 4003, 150000, 'Savings', '2027-12-31'],
        ['Ananya Singh', 4004, 500000, 'Fixed Deposit', '2028-09-30'],
      ],
    },
    {
      title: 'RIGHT JOIN — Branch + Loan',
      sql: `SELECT br.branch_name, l.loan_id, l.issued_amount
FROM Branch br
RIGHT JOIN Loan l ON br.branch_id = l.branch_id;`,
      columns: ['branch_name', 'loan_id', 'issued_amount'],
      rows: [
        ['Mumbai Main', 501, 500000], ['Mumbai Main', 502, 1000000],
        ['Delhi Central', 503, 300000], ['Bangalore Tech Park', 504, 750000],
        ['Chennai Anna Nagar', 505, 200000], ['Pune Koregaon', 506, 1500000],
      ],
    },
  ],
  aggregates: [
    {
      title: 'COUNT, SUM, AVG — Account balances',
      sql: `SELECT COUNT(*) AS total_accounts,
       SUM(account_balance) AS total_balance,
       AVG(account_balance) AS avg_balance,
       MIN(account_balance) AS min_balance,
       MAX(account_balance) AS max_balance
FROM Account;`,
      columns: ['total_accounts', 'total_balance', 'avg_balance', 'min_balance', 'max_balance'],
      rows: [[10, 1288000, 128800, 15000, 410000]],
    },
    {
      title: 'GROUP BY — Accounts per branch',
      sql: `SELECT b.branch_name, COUNT(a.account_id) AS num_accounts,
       SUM(a.account_balance) AS total_deposits
FROM Branch b
JOIN Account a ON b.branch_id = a.branch_id
GROUP BY b.branch_name
ORDER BY total_deposits DESC;`,
      columns: ['branch_name', 'num_accounts', 'total_deposits'],
      rows: [
        ['Pune Koregaon', 2, 472000], ['Chennai Anna Nagar', 2, 195000],
        ['Mumbai Main', 2, 165000], ['Delhi Central', 2, 328000],
        ['Bangalore Tech Park', 2, 128000],
      ],
    },
    {
      title: 'GROUP BY + HAVING — Branches with avg balance > 100000',
      sql: `SELECT b.branch_name, AVG(a.account_balance) AS avg_balance
FROM Branch b
JOIN Account a ON b.branch_id = a.branch_id
GROUP BY b.branch_name
HAVING AVG(a.account_balance) > 100000
ORDER BY avg_balance DESC;`,
      columns: ['branch_name', 'avg_balance'],
      rows: [['Pune Koregaon', 236000], ['Delhi Central', 164000]],
    },
    {
      title: 'SUM — Total loan payments per loan',
      sql: `SELECT l.loan_id, l.issued_amount, l.remaining_amount,
       SUM(lp.amount) AS total_paid
FROM Loan l
JOIN Loan_Payment lp ON l.loan_id = lp.loan_id
GROUP BY l.loan_id, l.issued_amount, l.remaining_amount;`,
      columns: ['loan_id', 'issued_amount', 'remaining_amount', 'total_paid'],
      rows: [
        [501, 500000, 350000, 150000], [502, 1000000, 800000, 200000],
        [503, 300000, 150000, 150000], [504, 750000, 600000, 150000],
        [505, 200000, 50000, 150000], [506, 1500000, 1200000, 300000],
      ],
    },
    {
      title: 'DISTINCT + ORDER BY + LIMIT + OFFSET',
      sql: `SELECT DISTINCT account_type FROM Account;

SELECT * FROM Transaction
ORDER BY amount DESC
LIMIT 5 OFFSET 2;`,
      columns: ['transaction_id', 'account_id', 'customer_id', 'amount'],
      rows: [
        [305, 104, 4, 50000], [303, 102, 2, 25000], [309, 108, 8, 30000],
        [307, 106, 6, 15000], [302, 101, 1, 12000],
      ],
    },
    {
      title: 'WHERE + LIKE + IN',
      sql: `SELECT * FROM Customer
WHERE customer_name LIKE 'A%';

SELECT * FROM Branch
WHERE branch_id IN (1, 3, 5);`,
      columns: ['customer_id', 'customer_name', 'dob', 'mobileno', 'account_id'],
      rows: [
        [1, 'Aarav Sharma', '1995-03-15', '9876543210', 101],
        [4, 'Ananya Singh', '1993-01-08', '9876543213', 104],
        [9, 'Arjun Menon', '1994-02-28', '9876543218', 109],
      ],
    },
  ],
  setops: [
    {
      title: 'UNION — Customers with loans OR credit cards',
      sql: `SELECT c.customer_id, c.customer_name, 'Borrower' AS type
FROM Customer c JOIN Borrower b ON c.customer_id = b.customer_id
UNION
SELECT c.customer_id, c.customer_name, 'Card Holder' AS type
FROM Customer c JOIN Credit_Card cc ON c.customer_id = cc.customer_id;`,
      columns: ['customer_id', 'customer_name', 'type'],
      rows: [
        [1, 'Aarav Sharma', 'Borrower'], [2, 'Meera Patel', 'Borrower'],
        [3, 'Rohan Gupta', 'Borrower'], [5, 'Vikash Kumar', 'Borrower'],
        [7, 'Karthik Nair', 'Borrower'], [10, 'Shreya Das', 'Borrower'],
        [4, 'Ananya Singh', 'Card Holder'], [6, 'Pooja Reddy', 'Card Holder'],
        [8, 'Divya Iyer', 'Card Holder'],
      ],
    },
    {
      title: 'UNION ALL — All account references from Loan and Credit Card',
      sql: `SELECT account_id, 'Loan' AS source FROM Loan
UNION ALL
SELECT account_id, 'Credit Card' AS source FROM Credit_Card;`,
      columns: ['account_id', 'source'],
      rows: [
        [101, 'Loan'], [102, 'Loan'], [103, 'Loan'], [105, 'Loan'], [107, 'Loan'], [110, 'Loan'],
        [101, 'Credit Card'], [102, 'Credit Card'], [103, 'Credit Card'], [104, 'Credit Card'],
        [106, 'Credit Card'], [108, 'Credit Card'], [110, 'Credit Card'],
      ],
    },
    {
      title: 'INTERSECT (via IN) — Customers who are both borrowers and card holders',
      sql: `SELECT DISTINCT c.customer_id, c.customer_name
FROM Customer c
JOIN Borrower b ON c.customer_id = b.customer_id
WHERE c.customer_id IN (
  SELECT cc.customer_id FROM Credit_Card cc
);`,
      columns: ['customer_id', 'customer_name'],
      rows: [
        [1, 'Aarav Sharma'], [2, 'Meera Patel'], [3, 'Rohan Gupta'], [10, 'Shreya Das'],
      ],
    },
    {
      title: 'EXCEPT (via NOT IN) — Borrowers who do NOT have a credit card',
      sql: `SELECT DISTINCT c.customer_id, c.customer_name
FROM Customer c
JOIN Borrower b ON c.customer_id = b.customer_id
WHERE c.customer_id NOT IN (
  SELECT cc.customer_id FROM Credit_Card cc
);`,
      columns: ['customer_id', 'customer_name'],
      rows: [[5, 'Vikash Kumar'], [7, 'Karthik Nair']],
    },
  ],
  advanced: [
    {
      title: 'Subquery — Customers with balance above average',
      sql: `SELECT c.customer_name, a.account_balance
FROM Customer c
JOIN Account a ON c.account_id = a.account_id
WHERE a.account_balance > (
  SELECT AVG(account_balance) FROM Account
);`,
      columns: ['customer_name', 'account_balance'],
      rows: [
        ['Ananya Singh', 250000], ['Divya Iyer', 180000], ['Shreya Das', 410000],
      ],
    },
    {
      title: 'ANY — Branches with assets > ANY Chennai branch',
      sql: `SELECT branch_name, assets
FROM Branch
WHERE assets > ANY (
  SELECT assets FROM Branch
  WHERE branch_address LIKE '%Chennai%'
);`,
      columns: ['branch_name', 'assets'],
      rows: [
        ['Mumbai Main', 50000000], ['Delhi Central', 42000000], ['Bangalore Tech Park', 38000000],
      ],
    },
    {
      title: 'ALL — Accounts with balance > ALL Savings accounts',
      sql: `SELECT account_id, account_balance, account_type
FROM Account
WHERE account_balance > ALL (
  SELECT account_balance FROM Account
  WHERE account_type = 'Savings'
);`,
      columns: ['account_id', 'account_balance', 'account_type'],
      rows: [
        [102, 120000, 'Current'], [104, 250000, 'Fixed Deposit'],
        [108, 180000, 'Fixed Deposit'], [110, 410000, 'Current'],
      ],
    },
    {
      title: 'Correlated Subquery — Transactions above customer avg',
      sql: `SELECT t.transaction_id, c.customer_name, t.amount
FROM Transaction t
JOIN Customer c ON t.customer_id = c.customer_id
WHERE t.amount > (
  SELECT AVG(t2.amount)
  FROM Transaction t2
  WHERE t2.customer_id = t.customer_id
);`,
      columns: ['transaction_id', 'customer_name', 'amount'],
      rows: [
        [302, 'Aarav Sharma', 12000],
      ],
    },
    {
      title: 'EXISTS — Branches that have at least one loan',
      sql: `SELECT branch_name
FROM Branch b
WHERE EXISTS (
  SELECT 1 FROM Loan l
  WHERE l.branch_id = b.branch_id
);`,
      columns: ['branch_name'],
      rows: [
        ['Mumbai Main'], ['Delhi Central'], ['Bangalore Tech Park'],
        ['Chennai Anna Nagar'], ['Pune Koregaon'],
      ],
    },
  ],
};

// ============================================================
// 4. DOM ELEMENT REFERENCES
// ============================================================
const recordModal = document.getElementById('record-modal');
const tableDetailModal = document.getElementById('table-detail-modal');
const overlay = document.querySelector('.overlay');
const btnsOpenModal = document.querySelectorAll('.btn--show-modal');
const allBtnsCloseModal = document.querySelectorAll('.btn--close-modal');
const btnScrollTo = document.querySelector('.btn--scroll-to');
const section1 = document.querySelector('#section--1');

// ============================================================
// 5. MODAL FUNCTIONALITY (Preserved from original)
// ============================================================
const openRecordModal = function (e) {
  e.preventDefault();
  recordModal.classList.remove('hidden');
  overlay.classList.remove('hidden');
  // Generate form for default table
  generateRecordForm(document.getElementById('modal-table-selector').value);
};

const openTableDetailModal = function (tableName) {
  tableDetailModal.classList.remove('hidden');
  overlay.classList.remove('hidden');
  renderTableDetail(tableName);
};

const closeAllModals = function () {
  recordModal.classList.add('hidden');
  tableDetailModal.classList.add('hidden');
  overlay.classList.add('hidden');
};

btnsOpenModal.forEach(b => b.addEventListener('click', openRecordModal));

allBtnsCloseModal.forEach(btn => btn.addEventListener('click', closeAllModals));
overlay.addEventListener('click', closeAllModals);

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeAllModals();
  }
});

// ============================================================
// 6. SMOOTH SCROLL (Preserved from original)
// ============================================================
btnScrollTo.addEventListener('click', function (e) {
  section1.scrollIntoView({ behavior: 'smooth' });
});

// Smooth scroll for all nav links
document.querySelector('.nav__links').addEventListener('click', function (e) {
  e.preventDefault();
  if (e.target.classList.contains('nav__link') && !e.target.classList.contains('btn--show-modal')) {
    const id = e.target.getAttribute('href');
    if (id && id !== '#') {
      document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  }
});

// ============================================================
// 7. STICKY NAVIGATION (IntersectionObserver)
// ============================================================
const header = document.querySelector('.header');
const nav = document.querySelector('.nav');
const navHeight = nav.getBoundingClientRect().height;

const stickyNav = function (entries) {
  const [entry] = entries;
  if (!entry.isIntersecting) nav.classList.add('sticky');
  else nav.classList.remove('sticky');
};

const headerObserver = new IntersectionObserver(stickyNav, {
  root: null,
  threshold: 0,
  rootMargin: `-${navHeight}px`,
});
headerObserver.observe(header);

// ============================================================
// 8. SECTION REVEAL (IntersectionObserver)
// ============================================================
const allSections = document.querySelectorAll('.section');

const revealSection = function (entries, observer) {
  const [entry] = entries;
  if (!entry.isIntersecting) return;
  entry.target.classList.remove('section--hidden');
  observer.unobserve(entry.target);
};

const sectionObserver = new IntersectionObserver(revealSection, {
  root: null,
  threshold: 0.15,
});

allSections.forEach(function (section) {
  sectionObserver.observe(section);
  section.classList.add('section--hidden');
});

// ============================================================
// 9. OPERATIONS TAB SWITCHING (Was missing from original JS)
// ============================================================
const tabsContainer = document.querySelector('.operations__tab-container');
const tabs = document.querySelectorAll('.operations__tab');
const tabsContent = document.querySelectorAll('.operations__content');

tabsContainer.addEventListener('click', function (e) {
  const clicked = e.target.closest('.operations__tab');
  if (!clicked) return;

  // Remove active classes
  tabs.forEach(t => t.classList.remove('operations__tab--active'));
  tabsContent.forEach(c => c.classList.remove('operations__content--active'));

  // Activate clicked tab
  clicked.classList.add('operations__tab--active');
  document.querySelector(`.operations__content--${clicked.dataset.tab}`)
    .classList.add('operations__content--active');
});

// ============================================================
// 10. DOCUMENTATION TABS
// ============================================================
const docTabs = document.querySelectorAll('.doc-tab');
const docContents = document.querySelectorAll('.doc-content');

docTabs.forEach(tab => {
  tab.addEventListener('click', function () {
    docTabs.forEach(t => t.classList.remove('doc-tab--active'));
    docContents.forEach(c => c.classList.remove('doc-content--active'));
    this.classList.add('doc-tab--active');
    document.querySelector(`.doc-content--${this.dataset.doc}`).classList.add('doc-content--active');
  });
});

// ============================================================
// 11. QUERY LAB — SLIDER
// ============================================================
let currentCategory = 'joins';
let currentSlide = 0;
let slides = [];

function renderQuerySlides(category) {
  const slider = document.querySelector('.slider');
  // Remove old slides
  slider.querySelectorAll('.slide').forEach(s => s.remove());

  const queries = queryLabData[category];
  slides = [];

  queries.forEach((q, i) => {
    const slide = document.createElement('div');
    slide.classList.add('slide', `slide--${i + 1}`);

    // Build result table HTML
    let resultHTML = '<table>';
    resultHTML += '<thead><tr>' + q.columns.map(c => `<th>${c}</th>`).join('') + '</tr></thead>';
    resultHTML += '<tbody>';
    q.rows.forEach(row => {
      resultHTML += '<tr>' + row.map(val => `<td>${val}</td>`).join('') + '</tr>';
    });
    resultHTML += '</tbody></table>';

    slide.innerHTML = `
      <div class="query-slide">
        <h5 class="query-slide__title">${q.title}</h5>
        <pre class="query-slide__sql">${q.sql}</pre>
        <div class="query-slide__result">${resultHTML}</div>
      </div>
    `;
    slider.insertBefore(slide, slider.querySelector('.slider__btn--left'));
    slides.push(slide);
  });

  currentSlide = 0;
  updateSlidePositions();
  createDots();
}

function updateSlidePositions() {
  slides.forEach((s, i) => {
    s.style.transform = `translateX(${100 * (i - currentSlide)}%)`;
  });
}

function createDots() {
  const dotsContainer = document.querySelector('.dots');
  dotsContainer.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.classList.add('dots__dot');
    if (i === currentSlide) dot.classList.add('dots__dot--active');
    dot.dataset.slide = i;
    dotsContainer.appendChild(dot);
  });
}

function activateDot(slide) {
  document.querySelectorAll('.dots__dot').forEach(d => d.classList.remove('dots__dot--active'));
  document.querySelector(`.dots__dot[data-slide="${slide}"]`)?.classList.add('dots__dot--active');
}

// Slider buttons
document.querySelector('.slider__btn--right').addEventListener('click', function () {
  currentSlide = currentSlide >= slides.length - 1 ? 0 : currentSlide + 1;
  updateSlidePositions();
  activateDot(currentSlide);
});

document.querySelector('.slider__btn--left').addEventListener('click', function () {
  currentSlide = currentSlide <= 0 ? slides.length - 1 : currentSlide - 1;
  updateSlidePositions();
  activateDot(currentSlide);
});

// Dot navigation
document.querySelector('.dots').addEventListener('click', function (e) {
  if (e.target.classList.contains('dots__dot')) {
    currentSlide = Number(e.target.dataset.slide);
    updateSlidePositions();
    activateDot(currentSlide);
  }
});

// Keyboard navigation for slider
document.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowLeft') {
    currentSlide = currentSlide <= 0 ? slides.length - 1 : currentSlide - 1;
    updateSlidePositions();
    activateDot(currentSlide);
  }
  if (e.key === 'ArrowRight') {
    currentSlide = currentSlide >= slides.length - 1 ? 0 : currentSlide + 1;
    updateSlidePositions();
    activateDot(currentSlide);
  }
});

// Category buttons
document.querySelectorAll('.query-cat-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.query-cat-btn').forEach(b => b.classList.remove('query-cat-btn--active'));
    this.classList.add('query-cat-btn--active');
    currentCategory = this.dataset.category;
    renderQuerySlides(currentCategory);
  });
});

// Initialize slider
renderQuerySlides('joins');

// ============================================================
// 12. TABLE CARDS — Click to show detail modal
// ============================================================
document.querySelectorAll('.table-card').forEach(card => {
  card.addEventListener('click', function () {
    openTableDetailModal(this.dataset.table);
  });
});

// Schema entities — Click to show detail modal
document.querySelectorAll('.schema-entity--clickable').forEach(entity => {
  entity.addEventListener('click', function () {
    openTableDetailModal(this.dataset.schemaTable);
  });
});

function renderTableDetail(tableName) {
  const meta = tableMetadata[tableName];
  if (!meta) return;

  document.getElementById('table-detail-title').innerHTML =
    `${meta.displayName} <span style="font-size:1.8rem;color:#999;">Table</span>`;

  const content = document.getElementById('table-detail-content');

  // Attributes section
  let attrsHTML = meta.attributes.map(attr => {
    let cls = 'detail-attr';
    if (attr === meta.primaryKey) cls += ' detail-attr--pk';
    else if (meta.foreignKeys.some(fk => fk.field === attr)) cls += ' detail-attr--fk';
    return `<span class="${cls}">${attr}</span>`;
  }).join('');

  // Foreign keys section
  let fkHTML = '';
  if (meta.foreignKeys.length > 0) {
    fkHTML = `<div class="detail-section">
      <h5>Foreign Keys</h5>
      <ul class="detail-relationships">
        ${meta.foreignKeys.map(fk => `<li>${fk.field} → ${fk.references}</li>`).join('')}
      </ul>
    </div>`;
  }

  // Sample data
  const data = sampleData[tableName] || [];
  let sampleHTML = '';
  if (data.length > 0) {
    const cols = meta.attributes;
    const displayRows = data.slice(0, 5);
    sampleHTML = `<div class="detail-section">
      <h5>Sample Data (${data.length} records)</h5>
      <div class="query-slide__result" style="margin-top: 1rem;">
        <table>
          <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${displayRows.map(row =>
            `<tr>${cols.map(c => `<td>${row[c]}</td>`).join('')}</tr>`
          ).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }

  content.innerHTML = `
    <div class="detail-section">
      <h5>Primary Key</h5>
      <span class="detail-attr detail-attr--pk">${meta.primaryKey}</span>
    </div>
    <div class="detail-section">
      <h5>Attributes</h5>
      <div class="detail-attrs">${attrsHTML}</div>
    </div>
    ${fkHTML}
    <div class="detail-section">
      <h5>Constraints</h5>
      <ul class="detail-constraints">
        ${meta.constraints.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>
    <div class="detail-section">
      <h5>Relationships</h5>
      <ul class="detail-relationships">
        ${meta.relationships.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
    ${sampleHTML}
  `;
}

// ============================================================
// 13. DYNAMIC RECORD FORM GENERATION
// ============================================================
const modalTableSelector = document.getElementById('modal-table-selector');
const modalTableName = document.getElementById('modal-table-name');
const recordForm = document.getElementById('record-form');

modalTableSelector.addEventListener('change', function () {
  generateRecordForm(this.value);
});

function generateRecordForm(tableName) {
  const meta = tableMetadata[tableName];
  if (!meta) return;

  modalTableName.textContent = meta.displayName;

  let formHTML = '';
  meta.attributes.forEach(attr => {
    const fieldType = meta.fieldTypes[attr];
    const isRequired = attr === meta.primaryKey || meta.constraints.some(c =>
      c.includes('NOT NULL') && c.includes(attr)
    );

    formHTML += `<label>${attr}</label>`;

    if (fieldType.startsWith('fk-')) {
      // Foreign key — render as dropdown
      const refTable = fieldType.replace('fk-', '');
      const refData = sampleData[refTable] || [];
      const refMeta = tableMetadata[refTable];
      const refPK = refMeta ? refMeta.primaryKey : 'id';

      formHTML += `<select name="${attr}" ${isRequired ? 'required' : ''}>`;
      formHTML += `<option value="">-- Select ${refTable} --</option>`;
      refData.forEach(row => {
        const label = row[refPK] + (row[refMeta?.attributes[1]] ? ` — ${row[refMeta.attributes[1]]}` : '');
        formHTML += `<option value="${row[refPK]}">${label}</option>`;
      });
      formHTML += '</select>';
    } else if (fieldType === 'select-account_type') {
      formHTML += `<select name="${attr}" ${isRequired ? 'required' : ''}>
        <option value="">-- Select Type --</option>
        <option value="Savings">Savings</option>
        <option value="Current">Current</option>
        <option value="Fixed Deposit">Fixed Deposit</option>
      </select>`;
    } else if (fieldType === 'date') {
      formHTML += `<input type="date" name="${attr}" ${isRequired ? 'required' : ''} placeholder="${attr}" />`;
    } else if (fieldType === 'tel') {
      formHTML += `<input type="tel" name="${attr}" pattern="[0-9]{10}" title="Enter 10-digit mobile number" ${isRequired ? 'required' : ''} placeholder="10-digit number" />`;
    } else if (fieldType === 'number') {
      const isAmount = attr.includes('amount') || attr.includes('balance') || attr.includes('assets') || attr.includes('limit');
      formHTML += `<input type="number" name="${attr}" ${isAmount ? 'step="0.01" min="0"' : 'min="1"'} ${isRequired ? 'required' : ''} placeholder="${attr}" />`;
    } else {
      formHTML += `<input type="text" name="${attr}" ${isRequired ? 'required' : ''} placeholder="${attr}" />`;
    }
  });

  formHTML += '<button class="btn">Add Record &rarr;</button>';
  recordForm.innerHTML = formHTML;
}

// Form submission handler
recordForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const tableName = modalTableSelector.value;
  const formData = new FormData(this);
  const record = {};
  formData.forEach((value, key) => {
    record[key] = value;
  });

  // TODO: Connect to backend API (see Section 14)
  // For now, add to local sampleData and show success
  console.log(`[DEMO] Record to insert into ${tableName}:`, record);

  // Add to local store (demo only)
  if (sampleData[tableName]) {
    sampleData[tableName].push(record);
  }

  // Show success message
  const successMsg = document.createElement('div');
  successMsg.classList.add('form-success');
  successMsg.textContent = `✓ Record added to ${tableMetadata[tableName].displayName} (demo mode — connect backend for persistence)`;
  this.appendChild(successMsg);

  setTimeout(() => {
    successMsg.remove();
    this.reset();
  }, 3000);
});

// Initialize default form
generateRecordForm('customer');

// ============================================================
// 14. BACKEND API STUBS
//     Replace these with actual API calls when backend is ready.
//     DO NOT put database credentials here.
// ============================================================

// --- Fetch (READ) stubs ---
async function fetchBranches() {
  // TODO: Replace with actual API call, e.g.:
  // const response = await fetch('/api/branches');
  // return await response.json();
  return sampleData.branch;
}

async function fetchBankers() {
  // TODO: Connect to backend
  return sampleData.banker;
}

async function fetchAccounts() {
  // TODO: Connect to backend
  return sampleData.account;
}

async function fetchCustomers() {
  // TODO: Connect to backend
  return sampleData.customer;
}

async function fetchLoans() {
  // TODO: Connect to backend
  return sampleData.loan;
}

async function fetchLoanPayments() {
  // TODO: Connect to backend
  return sampleData.loan_payment;
}

async function fetchBorrowers() {
  // TODO: Connect to backend
  return sampleData.borrower;
}

async function fetchTransactions() {
  // TODO: Connect to backend
  return sampleData.transaction;
}

async function fetchCreditCards() {
  // TODO: Connect to backend
  return sampleData.credit_card;
}

// --- Insert (CREATE) stubs ---
async function insertCustomer(data) {
  // TODO: Replace with actual API call, e.g.:
  // const response = await fetch('/api/customers', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(data)
  // });
  // return await response.json();
  console.log('[API STUB] insertCustomer:', data);
  sampleData.customer.push(data);
  return { success: true, data };
}

async function insertAccount(data) {
  // TODO: Connect to backend
  console.log('[API STUB] insertAccount:', data);
  sampleData.account.push(data);
  return { success: true, data };
}

async function insertLoan(data) {
  // TODO: Connect to backend
  console.log('[API STUB] insertLoan:', data);
  sampleData.loan.push(data);
  return { success: true, data };
}

async function insertRecord(tableName, data) {
  // TODO: Generic insert — connect to backend
  console.log(`[API STUB] insertRecord into ${tableName}:`, data);
  if (sampleData[tableName]) sampleData[tableName].push(data);
  return { success: true, tableName, data };
}

// --- Query execution stub ---
async function executeQuery(query) {
  // TODO: Replace with actual backend SQL execution, e.g.:
  // const response = await fetch('/api/query', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ sql: query })
  // });
  // return await response.json();
  console.log('[API STUB] executeQuery:', query);
  return { success: false, message: 'Backend not connected. This is a frontend demo.' };
}

// ============================================================
// 15. UTILITY FUNCTIONS (Preserved from original)
// ============================================================
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const randomColor = () => `rgb(${randomInt(0, 255)},${randomInt(0, 255)},${randomInt(0, 255)})`;

// ============================================================
// 16. NAV HOVER FADE EFFECT
// ============================================================
const handleHover = function (e) {
  if (e.target.classList.contains('nav__link')) {
    const link = e.target;
    const siblings = link.closest('.nav').querySelectorAll('.nav__link');
    const logo = link.closest('.nav').querySelector('img');

    siblings.forEach(el => {
      if (el !== link) el.style.opacity = this;
    });
    if (logo) logo.style.opacity = this;
  }
};

nav.addEventListener('mouseover', handleHover.bind(0.5));
nav.addEventListener('mouseout', handleHover.bind(1));