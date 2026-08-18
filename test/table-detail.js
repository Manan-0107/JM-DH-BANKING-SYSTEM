'use strict';

const TABLES_DATA = {
  branch: {
    name: 'Branch',
    icon: '🏦',
    subtitle: 'Nationwide branch network, smart vault tracking, geo-location mapping, and Swift code routing.',
    pills: [
      { text: 'Entities: 120+ Branches', type: 'primary' },
      { text: 'Security: Tier-4 Vaults', type: 'secondary' },
      { text: 'Network: Swift & IBAN', type: 'tertiary' }
    ],
    features: [
      {
        icon: '📍',
        title: 'Geo-Location Routing',
        desc: 'Auto-route customer transactions to the nearest regional vault node for fastest clearing speed.'
      },
      {
        icon: '🔐',
        title: 'Multi-Level Vault Security',
        desc: 'Real-time physical and digital vault balance monitoring with multi-signature authorization.'
      },
      {
        icon: '⏱️',
        title: 'Queue & Counter Analytics',
        desc: 'Predictive counter staffing and customer wait-time optimization algorithms.'
      },
      {
        icon: '🌐',
        title: 'Swift & Local Clearing',
        desc: 'Integrated IBAN, Routing, and Swift network protocol management.'
      }
    ],
    headers: ['Branch ID', 'Branch Name', 'City', 'Vault Reserve', 'Manager', 'Status'],
    rows: [
      ['BR-101', 'Downtown Central', 'New York', '$45,250,000', 'Sarah Connor', 'Active'],
      ['BR-102', 'Bay Ridge Hub', 'San Francisco', '$32,100,000', 'Alex Rivera', 'Active'],
      ['BR-103', 'Financial District', 'London', '$58,900,000', 'Marcus Vance', 'Active'],
      ['BR-104', 'Metro Plaza', 'Chicago', '$19,450,000', 'Elena Rostova', 'Active'],
      ['BR-105', 'Tech Quarter', 'Austin', '$28,700,000', 'David Kim', 'Pending']
    ]
  },

  account: {
    name: 'Account',
    icon: '💳',
    subtitle: 'High-yield savings, checking, interest accruals, overdraft rules, and multi-currency balances.',
    pills: [
      { text: 'Ledger: Real-Time Sync', type: 'primary' },
      { text: 'Yield: Up to 4.8% APY', type: 'secondary' },
      { text: 'Currencies: USD, EUR, GBP', type: 'tertiary' }
    ],
    features: [
      {
        icon: '📈',
        title: 'Automated Interest Engine',
        desc: 'Daily compounding calculations with zero manual intervention or delay.'
      },
      {
        icon: '🛡️',
        title: 'Overdraft Shield',
        desc: 'Smart overdraft protection with configurable safety limits and instant SMS alerts.'
      },
      {
        icon: '💱',
        title: 'Multi-Currency Ledgers',
        desc: 'Hold USD, EUR, GBP, and JPY under a single unified master banking account.'
      },
      {
        icon: '⚡',
        title: 'Instant Balance Auditing',
        desc: 'Sub-millisecond ledger reconciliation across all active distributed database nodes.'
      }
    ],
    headers: ['Account No', 'Customer ID', 'Account Type', 'Payment Mode', 'Currency', 'Balance', 'Status'],
    rows: [
      ['ACC-883921', 'CUST-104', 'High-Yield Savings', 'RTGS', 'USD', '$142,500.00', 'Active'],
      ['ACC-772910', 'CUST-101', 'Premium Checking', 'NEFT', 'USD', '$28,430.50', 'Active'],
      ['ACC-664019', 'CUST-103', 'International Treasury', 'RTGS', 'EUR', '€95,120.00', 'Active'],
      ['ACC-553102', 'CUST-102', 'Student Advantage', 'NEFT', 'USD', '$3,850.75', 'Active'],
      ['ACC-442991', 'CUST-105', 'Business Checking', 'RTGS', 'GBP', '£210,000.00', 'Active']
    ]
  },

  customer: {
    name: 'Customer',
    icon: '🧑',
    subtitle: 'Biometric identity management, instant KYC verification, credit scoring, and risk profiling.',
    pills: [
      { text: 'KYC: Automated AI Pass', type: 'primary' },
      { text: 'Security: Biometric Auth', type: 'secondary' },
      { text: 'Tiers: Silver to VIP', type: 'tertiary' }
    ],
    features: [
      {
        icon: '🪪',
        title: 'Instant KYC Verification',
        desc: 'AI-driven document authentication and government database validation in seconds.'
      },
      {
        icon: '📊',
        title: 'Credit Score Radar',
        desc: 'Continuous credit assessment and automatic loan pre-approval eligibility scoring.'
      },
      {
        icon: '🔒',
        title: 'Biometric Vault Auth',
        desc: 'Passkey, fingerprint, and face ID biometric session protection for maximum security.'
      },
      {
        icon: '👨‍👩‍👧',
        title: 'Family & Corporate Linkage',
        desc: 'Connect household members and corporate delegates with granular role permissions.'
      }
    ],
    headers: ['Customer ID', 'Full Name', 'Email', 'Credit Score', 'KYC Status', 'Tier'],
    rows: [
      ['CUST-101', 'Aarav Lynn', 'aarav@example.com', '810', 'Verified', 'Platinum'],
      ['CUST-102', 'Miyah Miles', 'miyah@example.com', '760', 'Verified', 'Gold'],
      ['CUST-103', 'Francisco Gomes', 'francisco@example.com', '790', 'Verified', 'Platinum'],
      ['CUST-104', 'Elena Rostova', 'elena@example.com', '745', 'Pending', 'Silver'],
      ['CUST-105', 'Liam Chen', 'liam@example.com', '830', 'Verified', 'VIP']
    ]
  },

  loan: {
    name: 'Loan',
    icon: '🏠',
    subtitle: 'Mortgages, auto loans, personal financing, automated EMI auto-debit, and amortization schedules.',
    pills: [
      { text: 'Rates: From 3.5% APR', type: 'primary' },
      { text: 'Approval: Sub-5 Minutes', type: 'secondary' },
      { text: 'Tenure: Up to 30 Years', type: 'tertiary' }
    ],
    features: [
      {
        icon: '🧮',
        title: 'Smart Amortization Calculator',
        desc: 'Real-time interest schedule calculation with dynamic tenure and prepayment options.'
      },
      {
        icon: '🚀',
        title: 'Pre-Approval Engine',
        desc: 'Instant credit-scoring algorithm for pre-approved credit lines without credit impact.'
      },
      {
        icon: '💸',
        title: 'EMI Auto-Debit Sync',
        desc: 'Zero-penalty automatic repayment deductions linked to preferred savings accounts.'
      },
      {
        icon: '📑',
        title: 'Collateral Registry',
        desc: 'Encrypted digital deed and asset collateral tracking with automated valuation.'
      }
    ],
    headers: ['Loan ID', 'Customer ID', 'Loan Type', 'Principal Amount', 'Interest Rate', 'Term (Mo)', 'Status'],
    rows: [
      ['LN-901', 'CUST-101', 'Home Mortgage', '$450,000', '3.5%', '360', 'Active'],
      ['LN-902', 'CUST-103', 'Electric Vehicle', '$38,000', '4.2%', '60', 'Active'],
      ['LN-903', 'CUST-102', 'Small Business', '$120,000', '5.0%', '120', 'Active'],
      ['LN-904', 'CUST-105', 'Commercial Property', '$850,000', '3.8%', '240', 'Active'],
      ['LN-905', 'CUST-104', 'Personal Credit Line', '$15,000', '6.5%', '36', 'Pending']
    ]
  },

  deposits: {
    name: 'Deposits',
    icon: '📊',
    subtitle: 'Fixed deposits, recurring certificates, flexible withdrawal rules, and yield trackers.',
    pills: [
      { text: 'Yield: Up to 5.5% Fixed', type: 'primary' },
      { text: 'Insured: FDIC Protected', type: 'secondary' },
      { text: 'Options: FD, RD & Treasury', type: 'tertiary' }
    ],
    features: [
      {
        icon: '🔒',
        title: 'Fixed Deposit Lock-In',
        desc: 'Guaranteed fixed yield rates with automated maturity payouts straight to checking.'
      },
      {
        icon: '🔁',
        title: 'Recurring Deposit Rules',
        desc: 'Monthly automated deposit sweeps from primary checking accounts to build wealth.'
      },
      {
        icon: '💡',
        title: 'Flexible Pre-Maturity Liquidity',
        desc: 'Instant liquidity withdrawal options without total loss of earned interest.'
      },
      {
        icon: '🎯',
        title: 'Maturity Goal Visualizer',
        desc: 'Project future deposit returns with interactive compounding timeline tools.'
      }
    ],
    headers: ['Deposit ID', 'Customer ID', 'Deposit Type', 'Amount', 'Maturity Date', 'Yield Rate', 'Status'],
    rows: [
      ['DEP-501', 'CUST-101', 'Fixed Deposit (3 Yrs)', '$50,000', '2027-08-15', '4.8%', 'Active'],
      ['DEP-502', 'CUST-103', 'Tax Saver FD', '$15,000', '2029-03-31', '5.2%', 'Active'],
      ['DEP-503', 'CUST-102', 'Recurring Deposit', '$1,200/mo', '2026-12-01', '4.5%', 'Active'],
      ['DEP-504', 'CUST-105', 'Treasury Certificate', '$250,000', '2028-06-30', '5.5%', 'Active'],
      ['DEP-505', 'CUST-104', 'Short-Term Deposit', '$10,000', '2026-11-15', '4.0%', 'Active']
    ]
  },

  cards: {
    name: 'Cards',
    icon: '💎',
    subtitle: 'Contactless debit, disposable virtual cards, custom spending limits, and real-time fraud alerts.',
    pills: [
      { text: 'Security: Dynamic CVV', type: 'primary' },
      { text: 'Rewards: 3% Unlimited Cash', type: 'secondary' },
      { text: 'NFC: Apple & Google Pay', type: 'tertiary' }
    ],
    features: [
      {
        icon: '💳',
        title: 'Disposable Virtual Cards',
        desc: 'Single-use dynamic card numbers generated on demand for secure online shopping.'
      },
      {
        icon: '🔒',
        title: 'Instant Card Freeze',
        desc: 'One-tap instant card lock/unlock directly from mobile app or web console.'
      },
      {
        icon: '📶',
        title: 'Contactless & NFC Controls',
        desc: 'Set custom tap-to-pay transaction limits and regional country permissions.'
      },
      {
        icon: '🎁',
        title: 'Cashback & Rewards Ledger',
        desc: 'Earn points on every purchase with zero blackout dates and instant redemption.'
      }
    ],
    headers: ['Card Number', 'Account No', 'Card Type', 'Expiry Date', 'Daily Limit', 'Status'],
    rows: [
      ['**** 4892', 'ACC-772910', 'Platinum Debit Visa', '08/28', '$5,000', 'Active'],
      ['**** 3102', 'ACC-883921', 'World Elite Mastercard', '11/29', '$10,000', 'Active'],
      ['**** 9918', 'ACC-664019', 'Virtual One-Time Card', '09/26', '$500', 'Active'],
      ['**** 2041', 'ACC-553102', 'Metal Contactless Debit', '04/27', '$2,500', 'Active'],
      ['**** 7183', 'ACC-442991', 'Business Credit Card', '01/30', '$25,000', 'Active']
    ]
  }
};

// Determine which table to load
function getSelectedTableKey() {
  const params = new URLSearchParams(window.location.search);
  let tableKey = params.get('table');

  if (!tableKey) {
    const path = window.location.pathname.toLowerCase();
    for (const key of Object.keys(TABLES_DATA)) {
      if (path.includes(key)) {
        tableKey = key;
        break;
      }
    }
  }

  if (!tableKey || !TABLES_DATA[tableKey.toLowerCase()]) {
    tableKey = 'branch';
  }

  return tableKey.toLowerCase();
}

function renderTableDetail() {
  const key = getSelectedTableKey();
  const data = TABLES_DATA[key];

  // Title & Metadata
  document.title = `Bankist | ${data.name} Features`;
  
  const heroIcon = document.getElementById('hero-icon');
  const heroTitle = document.getElementById('hero-title');
  const heroSubtitle = document.getElementById('hero-subtitle');
  const heroPills = document.getElementById('hero-pills');
  
  if (heroIcon) heroIcon.textContent = data.icon;
  if (heroTitle) heroTitle.textContent = `${data.name} Features`;
  if (heroSubtitle) heroSubtitle.textContent = data.subtitle;
  
  if (heroPills) {
    heroPills.innerHTML = data.pills
      .map(p => `<span class="detail-pill detail-pill--${p.type}">${p.text}</span>`)
      .join('');
  }

  // Render Features
  const featureGrid = document.getElementById('feature-grid');
  if (featureGrid) {
    featureGrid.innerHTML = data.features
      .map(
        f => `
      <div class="feature-card">
        <div class="feature-card__icon">${f.icon}</div>
        <h4 class="feature-card__title">${f.title}</h4>
        <p class="feature-card__desc">${f.desc}</p>
      </div>`
      )
      .join('');
  }

  // Render Data Table
  const tableHead = document.getElementById('table-head');
  const tableBody = document.getElementById('table-body');

  if (tableHead) {
    tableHead.innerHTML = `<tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  }

  if (tableBody) {
    renderTableRows(data.rows);
  }

  // Highlight active link in entity switcher
  document.querySelectorAll('.table-card').forEach(card => {
    const cardTable = card.getAttribute('data-table')?.toLowerCase();
    if (cardTable === key) {
      card.style.borderColor = 'var(--color-primary)';
      card.style.boxShadow = '0 0 0 2px var(--color-primary)';
    }
  });
}

function renderTableRows(rows) {
  const tableBody = document.getElementById('table-body');
  if (!tableBody) return;

  tableBody.innerHTML = rows
    .map(row => {
      const cellsHtml = row
        .map((cell, idx) => {
          if (idx === row.length - 1) {
            let badgeClass = 'status-badge--active';
            if (cell.toLowerCase().includes('pending')) badgeClass = 'status-badge--pending';
            if (cell.toLowerCase().includes('closed')) badgeClass = 'status-badge--closed';
            return `<td><span class="status-badge ${badgeClass}">${cell}</span></td>`;
          }
          if (cell === 'RTGS') {
            return `<td><span class="mode-badge mode-badge--rtgs">RTGS</span></td>`;
          }
          if (cell === 'NEFT') {
            return `<td><span class="mode-badge mode-badge--neft">NEFT</span></td>`;
          }
          return `<td>${cell}</td>`;
        })
        .join('');
      return `<tr>${cellsHtml}</tr>`;
    })
    .join('');
}

// Search functionality
function setupSearch() {
  const searchInput = document.getElementById('table-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', function (e) {
    const query = e.target.value.toLowerCase();
    const key = getSelectedTableKey();
    const data = TABLES_DATA[key];

    const filtered = data.rows.filter(row =>
      row.some(cell => cell.toLowerCase().includes(query))
    );

    renderTableRows(filtered);
  });
}

// Modal handling
function setupModal() {
  const modal = document.querySelector('.modal');
  const overlay = document.querySelector('.overlay');
  const btnCloseModal = document.querySelector('.btn--close-modal');
  const btnsOpenModal = document.querySelectorAll('.btn--show-modal');

  if (!modal || !overlay) return;

  const openModal = function (e) {
    if (e) e.preventDefault();
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
  };

  const closeModal = function () {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
  };

  btnsOpenModal.forEach(b => b.addEventListener('click', openModal));
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  renderTableDetail();
  setupSearch();
  setupModal();

  const navItemPersonal = document.getElementById('nav-item-personal');
  if (navItemPersonal) {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
      navItemPersonal.classList.remove('d-none');
    } else {
      navItemPersonal.classList.add('d-none');
    }
  }
});

