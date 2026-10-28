const assert = require('assert');

console.log('Running AI Co-Pilot PII Minimization & Masking Unit Tests (Synthetic Data)...');

// Replicate the pure prompt builder functions to test in Node environment
function maskAccountNumber(accountNumber) {
  if (!accountNumber) return 'N/A';
  const clean = accountNumber.toString().trim();
  if (clean.length <= 4) return '****';
  return `****${clean.slice(-4)}`;
}

function sanitizeDepositsForPrompt(deposits = []) {
  return deposits.map((d) => ({
    deposit_type: d.deposit_type,
    principal_amount: d.principal_amount,
    tenure_months: d.tenure_months,
    interest_rate: d.interest_rate,
    status: d.status,
  }));
}

function buildGeminiPrompt(prompt, ctx) {
  const maskedAcc = maskAccountNumber(ctx.primaryAccount?.account_number);
  const sanitizedDeposits = sanitizeDepositsForPrompt(ctx.deposits);

  const systemInstruction = `You are BTB Co-Pilot, the AI financial planning assistant for Bharat Trust Bank (BTB).
Aggregated Customer Financial Overview (Data Minimization & Privacy Preservation Applied):
- Customer Profile: Tier ${ctx.tier || 'Standard'}, Credit Bureau Score: ${ctx.creditScore || 'N/A'}
- Total Liquid Balance: INR ${ctx.totalBalance}
- Primary Account: ${maskedAcc} (${ctx.primaryAccount?.account_type || 'Savings'})
- Monthly Inflow: INR ${ctx.monthlyInflow}, Outflow: INR ${ctx.monthlyOutflow}, Net Savings: INR ${ctx.netSavings} (${ctx.savingsRate}%)
- Category Spending Aggregates: ${JSON.stringify(ctx.categorySpending)}
- Active Term Deposits: ${JSON.stringify(sanitizedDeposits)}

Respond concisely, professionally, and accurately in Indian Rupee format (₹, Lakhs, Crores). Always provide mathematical calculations when asked about investments, FD returns, loans, or budget burn rates.`;

  return `${systemInstruction}\n\nUser Question: ${prompt}`;
}

// Synthetic Customer Profile
const syntheticCustomer = {
  fullName: 'Vikramaditya Singhania',
  tier: 'VIP',
  creditScore: 825,
  totalBalance: 450000.50,
  primaryAccount: {
    account_number: 'ACC-99887766',
    account_type: 'Salary Account',
  },
  deposits: [
    {
      deposit_id: 'FD-SECRET-999',
      customer_id: 'CUST-SECRET-001',
      linked_account: 'ACC-99887766',
      deposit_type: 'Fixed Deposit',
      principal_amount: 100000,
      tenure_months: 12,
      interest_rate: 7.5,
      status: 'Active',
    },
  ],
  monthlyInflow: 150000,
  monthlyOutflow: 65000,
  netSavings: 85000,
  savingsRate: 57,
  categorySpending: [
    { name: 'Transfers & UPI', total: 30000 },
    { name: 'Utilities & Bills', total: 15000 },
  ],
  recentTransactions: [],
};

const userPrompt = 'Can I afford to invest ₹50,000 into a 1-year FD?';
const builtPrompt = buildGeminiPrompt(userPrompt, syntheticCustomer);

// Assertions:
// 1. Raw account number MUST NOT be present
assert.strictEqual(
  builtPrompt.includes('ACC-99887766'),
  false,
  'FAIL: Raw account number was found in outbound LLM prompt!'
);

// 2. Masked account number MUST be present
assert.strictEqual(
  builtPrompt.includes('****7766'),
  true,
  'FAIL: Masked account number ****7766 was NOT found in outbound LLM prompt!'
);

// 3. Customer full name MUST NOT be present in prompt
assert.strictEqual(
  builtPrompt.includes('Vikramaditya Singhania'),
  false,
  'FAIL: Customer full name was found in outbound LLM prompt!'
);

// 4. Deposit internal identifiers MUST NOT be present
assert.strictEqual(
  builtPrompt.includes('FD-SECRET-999'),
  false,
  'FAIL: Internal deposit ID was found in outbound LLM prompt!'
);
assert.strictEqual(
  builtPrompt.includes('CUST-SECRET-001'),
  false,
  'FAIL: Internal customer ID was found in outbound LLM prompt!'
);

// 5. Essential financial planning metrics MUST be preserved
assert.strictEqual(
  builtPrompt.includes('INR 450000.5'),
  true,
  'FAIL: Aggregated liquid balance missing from prompt!'
);
assert.strictEqual(
  builtPrompt.includes('7.5'),
  true,
  'FAIL: FD interest rate missing from prompt!'
);

console.log('[PASS] All 5 PII minimization & prompt masking assertions passed.');

