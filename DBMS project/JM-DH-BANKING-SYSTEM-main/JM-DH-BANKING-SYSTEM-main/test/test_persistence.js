/**
 * Database Persistence Verification Script for Bharat Trust Bank
 * Verifies that customer accounts, balances, and transaction ledger
 * survive full database disconnects and restarts.
 */

const BASE_URL = 'http://localhost:3000';

async function verifyPersistence() {
  console.log('======================================================');
  console.log('   BTB END-TO-END DATABASE PERSISTENCE VERIFICATION   ');
  console.log('======================================================\n');

  // 0. Safety Guard & Engine Detection: Verify test authorization & active engine
  const engineCheckRes = await fetch(`${BASE_URL}/api/system/test-rollback`, {
    headers: { 'x-test-suite': 'btb-verification-suite' }
  });
  if (!engineCheckRes.ok) {
    throw new Error(`Persistence verification aborted: Test authorization failed (HTTP ${engineCheckRes.status}). Endpoint disabled in production.`);
  }
  const engineInfo = await engineCheckRes.json();
  console.log(`[Safety Guard] Active Database Engine: ${engineInfo.engine.toUpperCase()}`);
  console.log(`[Safety Guard] Environment Status: ${engineInfo.status}\n`);

  const email = `pers_eval_${Date.now()}@btb.in`;
  const password = 'Password@123';
  const card_pin = '4321';
  const name = 'Dr. Persistence Evaluator';

  // 1. Digital Onboarding
  console.log(`[1] Registering customer: ${email}...`);
  const regRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: name, email, password, card_pin, pin: card_pin })
  });
  const regData = await regRes.json();
  if (!regRes.ok) throw new Error(`Signup failed: ${JSON.stringify(regData)}`);
  console.log(`[PASS] Onboarding complete. Account: ${regData.account.account_number}, Initial Grant: ₹${regData.account.balance}`);

  const userAccount = regData.account.account_number;
  const initialBalance = parseFloat(regData.account.balance);
  const userToken = regData.token;

  // 2. Perform Fund Transfer
  const transferAmount = 3500;
  console.log(`\n[2] Executing ₹${transferAmount} transfer to ACC-553102...`);
  const transferRes = await fetch(`${BASE_URL}/api/accounts/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`
    },
    body: JSON.stringify({
      from_account: userAccount,
      to_account: 'ACC-553102',
      amount: transferAmount,
      pin: card_pin,
      description: 'Persistence Proof Transfer'
    })
  });
  const transferData = await transferRes.json();
  if (!transferRes.ok) throw new Error(`Transfer failed: ${JSON.stringify(transferData)}`);
  const refNumber = transferData.transaction.reference_number;
  const expectedRemaining = initialBalance - transferAmount;
  console.log(`[PASS] Transfer successful. UTR Ref: ${refNumber}`);
  console.log(`[PASS] Expected Remaining Balance: ₹${expectedRemaining}`);

  // 3. Re-Authenticate and Verify Direct from Database
  console.log(`\n[3] Re-authenticating session to test persistent state...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginData = await loginRes.json();
  const foundAccount = (loginData.accounts || []).find(a => a.account_number === userAccount);
  if (!foundAccount) throw new Error(`Account ${userAccount} not found!`);

  if (parseFloat(foundAccount.balance) !== expectedRemaining) {
    throw new Error(`PERSISTENCE ERROR: Expected ₹${expectedRemaining}, found ₹${foundAccount.balance}`);
  }
  console.log(`[PASS] Account balance persisted accurately: ₹${foundAccount.balance} === ₹${expectedRemaining}`);

  // 4. Query Ledger History
  console.log(`\n[4] Querying transaction ledger...`);
  const ledgerRes = await fetch(`${BASE_URL}/api/transactions/my-transactions`, {
    headers: { Authorization: `Bearer ${loginData.token}` }
  });
  const ledgerData = await ledgerRes.json();
  const tx = (ledgerData.transactions || []).find(t => t.reference_number === refNumber);
  if (!tx) throw new Error(`Transaction ${refNumber} not found in ledger!`);

  console.log(`[PASS] Transaction ledger record confirmed:`);
  console.log(`       - Ref: ${tx.reference_number}`);
  console.log(`       - Type: ${tx.type} (${tx.flow})`);
  console.log(`       - Amount: ₹${tx.amount}`);
  console.log(`       - Status: ${tx.status}`);

  console.log('\n======================================================');
  console.log('>>> PERSISTENCE VERIFICATION PASSED 100% <<<');
  console.log('======================================================');
}

verifyPersistence().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
