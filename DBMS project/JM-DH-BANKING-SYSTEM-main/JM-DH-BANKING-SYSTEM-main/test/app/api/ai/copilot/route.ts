import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { maskAccountNumber, buildGeminiPrompt } from '@/lib/api-helpers';

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
      return NextResponse.json({ error: 'Unauthorized: Session invalid or expired' }, { status: 401 });
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
         WHERE (sender_account IN (${placeholders}) OR receiver_account IN (${placeholders})) 
         ORDER BY date_time DESC LIMIT 30`,
        [...accountNumbers, ...accountNumbers]
      );
      transactions = txRows || [];
    }

    // 5. Compute Monthly Inflow, Outflow, and Category Spending
    let monthlyInflow = 0;
    let monthlyOutflow = 0;
    const categoryTotals: Record<string, number> = {
      'Transfers & UPI': 0,
      'Deposits & Investments': 0,
      'Utilities & Bills': 0,
      'Cash & ATM': 0,
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

    // 6. Try Gemini API if GEMINI_API_KEY is available (with PII minimization)
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const aiResponse = await callGeminiApi(prompt, finCtx, geminiApiKey);
        if (aiResponse) {
          return NextResponse.json(aiResponse);
        }
      } catch (geminiError) {
        console.warn('Gemini API call skipped or failed. Falling back to deterministic heuristics.');
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

  // Pattern 1: Savings forecast & burn rate
  if (p.includes('forecast') || p.includes('month-end') || p.includes('project') || p.includes('burn')) {
    const dailyBurn = ctx.monthlyOutflow > 0 ? (ctx.monthlyOutflow / 30).toFixed(2) : '0';
    const runwayMonths = ctx.monthlyOutflow > 0 ? (ctx.totalBalance / ctx.monthlyOutflow).toFixed(1) : 'Infinite';
    return {
      reply: `Based on your recent transactions, your average daily burn rate is ₹${dailyBurn}/day with an estimated cash runway of ${runwayMonths} months. At current trends, your projected month-end balance will be ₹${Math.max(0, ctx.totalBalance - (ctx.monthlyOutflow * 0.3)).toLocaleString('en-IN')}.`,
      insights: [
        { label: 'Burn Rate', value: `₹${dailyBurn}/day`, positive: false },
        { label: 'Runway', value: `${runwayMonths} Months`, positive: parseFloat(runwayMonths) >= 3 },
      ],
      suggestedFollowUps: [
        'How can I optimize my monthly savings rate?',
        'Can I afford to open a ₹25,000 Fixed Deposit?',
      ],
    };
  }

  // Pattern 2: FD Compounding & Yield Advisory
  if (p.includes('fd') || p.includes('fixed deposit') || p.includes('invest') || p.includes('interest')) {
    const rate = 7.5; // BTB Platinum 1-Year Rate
    const testPrincipal = 50000;
    const testMaturity = Math.round(testPrincipal * (1 + (rate / 100)));
    return {
      reply: `Bharat Trust Bank offers competitive FD returns up to **${rate}% p.a.** on 1-year tenures for ${ctx.tier} customers. For example, depositing ₹${testPrincipal.toLocaleString('en-IN')} yields ₹${testMaturity.toLocaleString('en-IN')} upon maturity. You currently have ₹${ctx.totalBalance.toLocaleString('en-IN')} liquid balance available.`,
      insights: [
        { label: 'Top FD Rate', value: `${rate}% p.a.`, positive: true },
        { label: 'Liquid Surplus', value: `₹${ctx.totalBalance.toLocaleString('en-IN')}`, positive: true },
      ],
      suggestedFollowUps: [
        'Open a 1-year Fixed Deposit now',
        'Compare 1-year vs 3-year term deposit yields',
      ],
    };
  }

  // Pattern 3: Spending breakdown & budget leaks
  if (p.includes('spend') || p.includes('category') || p.includes('highest') || p.includes('budget') || p.includes('expense')) {
    const sorted = [...ctx.categorySpending].sort((a, b) => b.total - a.total);
    const top = sorted[0] || { name: 'None', total: 0 };
    return {
      reply: `Your total outflow this period was ₹${ctx.monthlyOutflow.toLocaleString('en-IN')}. Your highest expense category was **${top.name}** at ₹${top.total.toLocaleString('en-IN')} (${ctx.monthlyOutflow > 0 ? Math.round((top.total / ctx.monthlyOutflow) * 100) : 0}% of total spending).`,
      insights: sorted.slice(0, 3).map((c) => ({
        label: c.name,
        value: `₹${c.total.toLocaleString('en-IN')}`,
        positive: false,
      })),
      suggestedFollowUps: [
        'How can I reduce my transfers and discretionary spending?',
        'What is my monthly cash flow summary?',
      ],
    };
  }

  // Default intelligent assistant response
  return {
    reply: `Hello ${ctx.fullName}! I have analyzed your active Bharat Trust Bank profile:\n\n• **Total Liquid Balance:** ₹${ctx.totalBalance.toLocaleString('en-IN')}\n• **Active Accounts:** Primary account ${maskAccountNumber(ctx.primaryAccount?.account_number)}\n• **Recent Inflows:** ₹${ctx.monthlyInflow.toLocaleString('en-IN')} vs Outflows of ₹${ctx.monthlyOutflow.toLocaleString('en-IN')}\n• **Credit Bureau Score:** ${ctx.creditScore} (${ctx.tier} Status)\n\nHow can I assist your financial planning today? You can ask me to forecast your month-end balance, check FD compounding returns, or audit category spending.`,
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

// Call Gemini API if available (with PII minimization & masking)
async function callGeminiApi(prompt: string, ctx: FinancialContext, apiKey: string) {
  const fullPromptText = buildGeminiPrompt(prompt, ctx);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: fullPromptText }],
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
