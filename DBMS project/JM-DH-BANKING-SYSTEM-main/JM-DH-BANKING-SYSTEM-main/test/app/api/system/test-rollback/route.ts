import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest, generateTransactionReference } from '@/lib/auth';

/**
 * Internal Automated Test Endpoint for Failure-Driven Transaction Rollback Verification.
 * Strictly disabled in production environments.
 */
export async function POST(request: Request) {
  // 1. Strict Production Guard: Endpoint is disabled in production environments
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
  }

  // 2. Test Execution Header Guard: Prevents inadvertent invocation
  const testHeader = request.headers.get('x-test-suite');
  if (testHeader !== 'btb-verification-suite') {
    return NextResponse.json(
      { error: 'Forbidden: Test execution authorization required' },
      { status: 403 }
    );
  }

  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { account_number, amount = 1000, simulate_verification_failure = false } = body;

    if (!account_number) {
      return NextResponse.json({ error: 'account_number is required' }, { status: 400 });
    }

    const db = await getDb();

    // 3. Verify account ownership
    const [accRows] = await db.query(
      'SELECT account_number, balance FROM accounts WHERE account_number = ? AND customer_id = ?',
      [account_number, authUser.customer_id]
    );

    if (!accRows || accRows.length === 0) {
      return NextResponse.json({ error: 'Account not found or access denied' }, { status: 404 });
    }

    const startingBalance = parseFloat(accRows[0].balance);
    const { txnId, referenceNumber } = generateTransactionReference('TXN-ROLLBACK-PROBE');
    const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let caughtExpectedError = false;

    // 4. Execute via application's real transaction abstraction with guaranteed failure & rollback
    try {
      await db.transaction(async (conn) => {
        // Step A: Apply debit write
        await conn.query(
          'UPDATE accounts SET balance = balance - ? WHERE account_number = ?',
          [amount, account_number]
        );

        // Step B: Insert corresponding ledger record
        await conn.query(
          `INSERT INTO transactions (
            transaction_id, sender_account, receiver_account, amount, type, date_time, status, description, reference_number
          ) VALUES (?, ?, NULL, ?, 'Transfer', ?, 'Pending', 'Failure-Driven Rollback Verification Probe', ?)`,
          [txnId, account_number, amount, nowTime, referenceNumber]
        );

        // Step C: Trigger deliberate expected SQL error to force automatic transaction rollback
        await conn.query(
          'INSERT INTO non_existent_table_for_rollback_verification (invalid_column) VALUES (?)',
          ['deliberate_error_trigger']
        );
      });
    } catch (txErr: any) {
      const errMsg = String(txErr?.message || txErr);
      if (
        errMsg.includes('non_existent_table_for_rollback_verification') ||
        errMsg.includes('no such table') ||
        errMsg.includes("doesn't exist") ||
        errMsg.includes('Table')
      ) {
        caughtExpectedError = true;
      }
      console.log('[Test Rollback] Deliberate transaction failure caught. Validating postconditions...');
    }

    // 5. Verify post-rollback account balance and ledger state
    const [postAccRows] = await db.query(
      'SELECT balance FROM accounts WHERE account_number = ?',
      [account_number]
    );
    const postBalance = parseFloat(postAccRows[0]?.balance || '0');
    const balanceRestored = startingBalance === postBalance;

    const [txRows] = await db.query(
      'SELECT transaction_id FROM transactions WHERE transaction_id = ? OR reference_number = ?',
      [txnId, referenceNumber]
    );
    const ledgerRecordRemains = txRows && txRows.length > 0;

    // Strict multi-point verification: every single invariant must pass
    const isVerificationSuccessful =
      caughtExpectedError &&
      balanceRestored &&
      !ledgerRecordRemains &&
      !simulate_verification_failure;

    if (isVerificationSuccessful) {
      return NextResponse.json(
        {
          message: 'Deliberate transaction failure caught and rolled back automatically',
          error: 'Deliberate transaction failure triggered for rollback verification',
          rolledBack: true,
          verified: true,
          expected_failure_caught: true,
          starting_balance: startingBalance,
          post_balance: postBalance,
          balance_restored: true,
          ledger_record_remains: false,
          probe_txn_id: txnId,
          probe_reference_number: referenceNumber,
          engine: db.isSqlite ? 'sqlite' : 'mysql',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Rollback verification failed: invariants violated or unexpected error occurred',
        rolledBack: false,
        verified: false,
        expected_failure_caught: caughtExpectedError,
        balance_restored: balanceRestored,
        ledger_record_remains: ledgerRecordRemains,
      },
      { status: 500 }
    );
  } catch (err: any) {
    console.error('Test rollback endpoint error:', err?.message || 'Server error');
    return NextResponse.json(
      { error: 'An internal error occurred during test verification' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
  }

  const testHeader = request.headers.get('x-test-suite');
  if (testHeader !== 'btb-verification-suite') {
    return NextResponse.json(
      { error: 'Forbidden: Test execution authorization required' },
      { status: 403 }
    );
  }

  try {
    const db = await getDb();
    return NextResponse.json({
      engine: db.isSqlite ? 'sqlite' : 'mysql',
      isSqlite: !!db.isSqlite,
      status: 'active-test-environment',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }
}
