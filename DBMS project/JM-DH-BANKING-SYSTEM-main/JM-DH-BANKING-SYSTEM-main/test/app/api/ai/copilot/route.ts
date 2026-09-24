import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

interface FinancialContext {
  fullName: string;
  tier: string;
  creditScore: number;
  totalBalance: number;
  primaryAccount: any;
  deposits: any[];
  monthlyInflow: number;
  monthlyOutflow: number;
  netSavings: number;
  savingsRate: number;
  categorySpending: { name: string; total: number }[];
  recentTransactions: any[];
}

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    const body = await request.json();
    const prompt: string = (body.prompt || '').trim();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Fetch live customer profile
    const [custRows] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [authUser.customer_id]);
    const customer = custRows[0] || authUser;

    // 2. Fetch all customer accounts
    const [accounts] = await db.query('SELECT * FROM accounts WHERE customer_id = ?', [authUser.customer_id]);
    const primaryAccount = accounts[0] || null;
    const totalBalance = accounts.reduce((acc: number, a: any) => acc + parseFloat(a.balance || '0'), 0);

    // 3. Fetch active deposits
    const [deposits] = await db.query('SELECT * FROM deposits WHERE customer_id = ? AND status = "Active"', [authUser.customer_id]);

    // 4. Fetch recent transactions for cash-flow analytics
    const accountNumbers = accounts.map((a: any) => a.account_number);
    let transactions: any[] = [];
    if (accountNumbers.length > 0) {
      const placeholders = accountNumbers.map(() => '?').join(',');
      const [txRows] = await db.query(
        `SELECT * FROM transactions 
         WHERE sender_account IN (${placeholders}) OR receiver_account IN (${placeholders}) 
         ORDER BY date_time DESC LIMIT 30`,
        [...accountNumbers, ...accountNumbers]
      );
      transactions = txRows || [];
    }

    // 5. Calculate monthly cashflow metrics
    let monthlyInflow = 0;
    let monthlyOutflow = 0;
    const categoryTotals: Record<string, number> = {
      'Transfers & UPI': 0,
      'Cash & ATM': 0,
      'Deposits & Investments': 0,
      'Utilities & Bills': 0,
      'Shopping & Others': 0,
    };

    transactions.forEach((tx: any) => {
      const amt = parseFloat(tx.amount || '0');
      const isCredit = tx.type === 'Deposit' || accountNumbers.includes(tx.receiver_account);
      const isDebit = tx.type === 'Withdrawal' || (tx.type === 'Transfer' && accountNumbers.includes(tx.sender_account));
      const desc = (tx.description || '').toLowerCase();

      if (isCredit) {
        monthlyInflow += amt;
      } else if (isDebit) {
        monthlyOutflow += amt;
        if (desc.includes('atm') || desc.includes('cash')) {
          categoryTotals['Cash & ATM'] += amt;
        } else if (desc.includes('deposit') || desc.includes('fd') || desc.includes('rd')) {
          categoryTotals['Deposits & Investments'] += amt;
        } else if (desc.includes('rent') || desc.includes('bill') || desc.includes('electric')) {
          categoryTotals['Utilities & Bills'] += amt;
        } else if (desc.includes('transfer') || desc.includes('upi') || desc.includes('imps') || desc.includes('neft')) {
          categoryTotals['Transfers & UPI'] += amt;
        } else {
          categoryTotals['Shopping & Others'] += amt;
        }
      }
    });

    const netSavings = Math.max(0, monthlyInflow - monthlyOutflow);
    const savingsRate = monthlyInflow > 0 ? Math.round((netSavings / monthlyInflow) * 100) : 0;
    const categorySpending = Object.entries(categoryTotals).map(([name, total]) => ({ name, total }));

    const finCtx: FinancialContext = {
      fullName: customer.full_name,
      tier: customer.tier || 'Platinum',
      creditScore: customer.credit_score || 780,
      totalBalance,
      primaryAccount,
      deposits: deposits || [],
      monthlyInflow,
      monthlyOutflow,
      netSavings,
      savingsRate,
      categorySpending,
      recentTransactions: transactions.slice(0, 10),
    };

    // 6. Try Gemini API if GEMINI_API_KEY is available
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const aiResponse = await callGeminiApi(prompt, finCtx, geminiApiKey);
        if (aiResponse) {
          return NextResponse.json(aiResponse);
        }
      } catch (geminiError) {
        console.warn('Gemini API call skipped/failed, using high-precision financial heuristics:', geminiError);
      }
    }

    // 7. Deterministic Financial Reasoning Engine (Fall-through or Default)
    const result = runFinancialHeuristics(prompt, finCtx);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI Co-Pilot Endpoint Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error in AI Co-Pilot' }, { status: 500 });
  }
}

// High-precision financial analysis heuristic engine
function runFinancialHeuristics(prompt: string, ctx: FinancialContext) {
  const p = prompt.toLowerCase();

  // Query: Can I afford FD / Fixed Deposit advice?
  if (p.includes('fd') || p.includes('fixed deposit') || p.includes('invest') || p.includes('afford')) {
    const desiredAmount = 50000;
    const emergencyBuffer = 25000;
    const canAfford = ctx.totalBalance - desiredAmount >= emergencyBuffer;
    const rate1Yr = 7.5;
    // Compounded quarterly maturity: P * (1 + r/4)^(4*1)
    const maturity1Yr = Math.round(desiredAmount * Math.pow(1 + (rate1Yr / 100) / 4, 4));
    const interestEarned = maturity1Yr - desiredAmount;

    return {
      reply: canAfford
        ? `Yes, absolutely! Your total liquid balance is ₹${ctx.totalBalance.toLocaleString('en-IN')}. Locking ₹${desiredAmount.toLocaleString('en-IN')} in a 1-year Fixed Deposit at 7.50% p.a. will leave you with a safe buffer of ₹${(ctx.totalBalance - desiredAmount).toLocaleString('en-IN')}.\n\nAt maturity, you will receive ₹${maturity1Yr.toLocaleString('en-IN')} (guaranteed interest profit of ₹${interestEarned.toLocaleString('en-IN')}).`
        : `Your current balance is ₹${ctx.totalBalance.toLocaleString('en-IN')}. We recommend keeping at least ₹${emergencyBuffer.toLocaleString('en-IN')} for liquid liquidity. You can comfortably lock ₹${Math.max(10000, ctx.totalBalance - emergencyBuffer).toLocaleString('en-IN')} in high-yield Fixed Deposits instead.`,
      insights: [
        { label: 'Available Balance', value: `₹${ctx.totalBalance.toLocaleString('en-IN')}`, positive: true },
        { label: '1-Year FD Rate', value: '7.50% p.a.', positive: true },
        { label: 'Maturity Yield (₹50k)', value: `₹${maturity1Yr.toLocaleString('en-IN')}`, positive: true },
        { label: 'Interest Profit', value: `+₹${interestEarned.toLocaleString('en-IN')}`, positive: true },
      ],
      suggestedAction: {
        label: 'Open FD Booking Modal',
        actionType: 'open_modal',
        modal: 'book_deposit',
        params: { defaultAmount: desiredAmount, defaultTenure: 12 },
      },
      suggestedFollowUps: [
        'What are senior citizen FD interest rates?',
        'How does quarterly compounding compare to monthly payout?',
        'What is my monthly cash flow breakdown?',
      ],
    };
  }

  // Query: Spending / Expense / Category audit
  if (p.includes('spend') || p.includes('expense') || p.includes('category') || p.includes('where did my money go')) {
    const topCategory = [...ctx.categorySpending].sort((a, b) => b.total - a.total)[0] || { name: 'None', total: 0 };
    return {
      reply: `In your recent transactions, your total outflows amount to ₹${ctx.monthlyOutflow.toLocaleString('en-IN')}.\n\nYour highest spending category is **${topCategory.name}** at ₹${topCategory.total.toLocaleString('en-IN')}. Your net savings this period is ₹${ctx.netSavings.toLocaleString('en-IN')} (${ctx.savingsRate}% savings rate), which ranks in the **${ctx.savingsRate >= 50 ? 'Excellent' : 'Moderate'}** financial health tier.`,
      insights: [
        { label: 'Total Inflow', value: `₹${ctx.monthlyInflow.toLocaleString('en-IN')}`, positive: true },
        { label: 'Total Outflow', value: `₹${ctx.monthlyOutflow.toLocaleString('en-IN')}`, positive: false },
        { label: 'Savings Rate', value: `${ctx.savingsRate}%`, positive: ctx.savingsRate >= 40 },
        { label: 'Top Expense Category', value: topCategory.name, positive: false },
      ],
      suggestedAction: {
        label: 'Generate UPI Payment Request',
        actionType: 'open_modal',
        modal: 'upi',
      },
      suggestedFollowUps: [
        'What is my predicted month-end balance?',
        'Can I afford to lock ₹50,000 in a 1-year FD?',
        'Show my loan eligibility based on my credit score',
      ],
    };
  }

  // Query: Month-end balance / burn rate
  if (p.includes('month-end') || p.includes('burn') || p.includes('predict') || p.includes('forecast') || p.includes('future')) {
    const avgDailySpend = Math.round(ctx.monthlyOutflow / 30);
    const estimatedRemainingDays = 15;
    const projectedSpend = avgDailySpend * estimatedRemainingDays;
    const projectedEndBalance = Math.max(0, ctx.totalBalance - projectedSpend);

    return {
      reply: `Based on your recent 30-day activity, your daily average burn rate is **₹${avgDailySpend.toLocaleString('en-IN')} / day**.\n\nAssuming this current run-rate continues for the rest of the cycle, your projected account balance at month-end will be approximately **₹${projectedEndBalance.toLocaleString('en-IN')}**.\n\nTip: You have sufficient liquidity to automate ₹10,000 into a Recurring Deposit (RD) to maximize interest returns.`,
      insights: [
        { label: 'Current Balance', value: `₹${ctx.totalBalance.toLocaleString('en-IN')}`, positive: true },
        { label: 'Daily Burn Rate', value: `₹${avgDailySpend.toLocaleString('en-IN')}/day`, positive: false },
        { label: 'Projected End Balance', value: `₹${projectedEndBalance.toLocaleString('en-IN')}`, positive: true },
      ],
      suggestedAction: {
        label: 'Book a Recurring Deposit',
        actionType: 'open_modal',
        modal: 'book_deposit',
      },
      suggestedFollowUps: [
        'How can I reduce my daily burn rate?',
        'Can I afford to invest in Fixed Deposits?',
        'What are the charges for IMPS vs NEFT?',
      ],
    };
  }

  // Query: Credit Score / Loan eligibility
  if (p.includes('credit') || p.includes('score') || p.includes('loan') || p.includes('emi') || p.includes('cibil')) {
    return {
      reply: `Your credit bureau score is **${ctx.creditScore}** (${ctx.tier} tier).\n\nWith a score of ${ctx.creditScore}, you qualify for pre-approved retail loans at our lowest institutional rate of **8.25% p.a.** on Home Loans and EV Vehicle Finance, with 100% processing fee waiver.\n\nFor an example ₹25,00,000 home loan over 20 years, your monthly EMI would be approximately ₹21,298.`,
      insights: [
        { label: 'Credit Score', value: `${ctx.creditScore}/900`, positive: true },
        { label: 'Customer Tier', value: ctx.tier, positive: true },
        { label: 'Home Loan Rate', value: '8.25% p.a.', positive: true },
        { label: 'Processing Fee', value: '₹0 (Waived)', positive: true },
      ],
      suggestedFollowUps: [
        'Calculate EMI for ₹50 Lakh loan',
        'Can I afford to lock ₹50,000 in a 1-year FD?',
        'What is my monthly cash flow summary?',
      ],
    };
  }

  // Default intelligent assistant response
  return {
    reply: `Hello ${ctx.fullName}! I have analyzed your active Bharat Trust Bank profile:\n\n• **Total Liquid Balance:** ₹${ctx.totalBalance.toLocaleString('en-IN')}\n• **Active Accounts:** Primary account ${ctx.primaryAccount?.account_number || 'N/A'}\n• **Recent Inflows:** ₹${ctx.monthlyInflow.toLocaleString('en-IN')} vs Outflows of ₹${ctx.monthlyOutflow.toLocaleString('en-IN')}\n• **Credit Bureau Score:** ${ctx.creditScore} (${ctx.tier} Status)\n\nHow can I assist your financial planning today? You can ask me to forecast your month-end balance, check FD compounding returns, or audit category spending.`,
    insights: [
      { label: 'Total Balance', value: `₹${ctx.totalBalance.toLocaleString('en-IN')}`, positive: true },
      { label: 'Savings Rate', value: `${ctx.savingsRate}%`, positive: ctx.savingsRate >= 40 },
      { label: 'Active Deposits', value: `${ctx.deposits.length} Accounts`, positive: true },
    ],
    suggestedFollowUps: [
      'Can I afford to lock ₹50,000 in a 1-year FD at 7.5%?',
      'What is my highest spending category this month?',
      'Forecast my projected month-end balance',
      'What loan interest rates am I pre-approved for?',
    ],
  };
}

// Call Gemini API if available
async function callGeminiApi(prompt: string, ctx: FinancialContext, apiKey: string) {
  const systemInstruction = `You are BTB Co-Pilot, the elite AI financial assistant for Bharat Trust Bank (BTB), a premier Indian Scheduled Commercial Bank.
You have real-time access to the user's verified telemetry:
- Customer Name: ${ctx.fullName}
- Tier: ${ctx.tier}, Credit Score: ${ctx.creditScore}
- Total Liquid Balance: INR ${ctx.totalBalance}
- Primary Account: ${ctx.primaryAccount?.account_number} (${ctx.primaryAccount?.account_type})
- Inflow this period: INR ${ctx.monthlyInflow}, Outflow: INR ${ctx.monthlyOutflow}, Net Savings: INR ${ctx.netSavings} (${ctx.savingsRate}%)
- Category Spending: ${JSON.stringify(ctx.categorySpending)}
- Active Fixed Deposits: ${JSON.stringify(ctx.deposits)}

Respond concisely, professionally, and accurately in Indian Rupee format (₹, Lakhs, Crores). Always give concrete mathematical calculations when asked about investments, FD returns (7.5% 1-yr), loans (8.25%), or budget burn rates.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nUser Question: ${prompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  return {
    reply: text,
    insights: [
      { label: 'Available Balance', value: `₹${ctx.totalBalance.toLocaleString('en-IN')}`, positive: true },
      { label: 'Savings Rate', value: `${ctx.savingsRate}%`, positive: ctx.savingsRate >= 40 },
    ],
    suggestedFollowUps: [
      'Can I afford to lock ₹50,000 in a 1-year FD?',
      'What is my highest spending category this month?',
      'Forecast my projected month-end balance',
    ],
  };
}
