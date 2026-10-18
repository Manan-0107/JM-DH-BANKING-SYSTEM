import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest, generateTransactionReference } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { account_number, amount = 1000, trigger_failure = true } = body;

    if (!account_number) {
      return NextResponse.json({ error: 'account_number is required' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Fetch current account and verify ownership
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

    // 2. Execute via the application's real transaction abstraction
    let transactionErrorCaught: any = null;

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

        // Step C: Trigger deliberate database error before commit if requested
        if (trigger_failure) {
          await conn.query(
            'INSERT INTO non_existent_table_for_rollback_verification (invalid_column) VALUES (?)',
            ['deliberate_error_trigger']
          );
        }
      });
    } catch (txErr: any) {
      transactionErrorCaught = txErr;
    }

    // 3. Re-query account balance after transaction has concluded
    const [postAccRows] = await db.query(
      'SELECT balance FROM accounts WHERE account_number = ?',
      [account_number]
    );
    const postBalance = parseFloat(postAccRows[0].balance);

    // 4. Verify whether ledger record exists in database
    const [txRows] = await db.query(
      'SELECT transaction_id FROM transactions WHERE transaction_id = ? OR reference_number = ?',
      [txnId, referenceNumber]
    );
    const ledgerRecordRemains = txRows && txRows.length > 0;

    if (transactionErrorCaught) {
      return NextResponse.json(
        {
          message: 'Deliberate transaction failure triggered and caught by db.transaction abstraction',
          error: transactionErrorCaught.message,
          rolledBack: true,
          starting_balance: startingBalance,
          post_balance: postBalance,
          balance_restored: startingBalance === postBalance,
          ledger_record_remains: ledgerRecordRemains,
          probe_txn_id: txnId,
          probe_reference_number: referenceNumber,
          engine: db.isSqlite ? 'sqlite' : 'mysql',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Transaction committed successfully without injected error',
      starting_balance: startingBalance,
      post_balance: postBalance,
      probe_txn_id: txnId,
      probe_reference_number: referenceNumber,
      engine: db.isSqlite ? 'sqlite' : 'mysql',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error during rollback test' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = await getDb();
    return NextResponse.json({
      engine: db.isSqlite ? 'sqlite' : 'mysql',
      isSqlite: !!db.isSqlite,
      status: 'active',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Database unavailable' },
      { status: 503 }
    );
  }
}
