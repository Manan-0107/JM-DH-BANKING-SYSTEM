'use strict';

/**
 * Overrides the default TABLES_DATA for customer and account with live API data.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check if we are on a table detail page
  if (typeof getSelectedTableKey !== 'function') return;

  const key = getSelectedTableKey();
  
  // Only intercept customer and account tables
  if (key === 'customer' || key === 'account') {
    interceptTableRendering(key);
  }
});

async function interceptTableRendering(key) {
  const tableBody = document.getElementById('table-body');
  if (!tableBody) return;

  // Show loading state
  tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem;"><div class="loading-spinner"></div> Loading live data...</td></tr>`;

  try {
    let apiData = [];
    
    if (key === 'customer') {
      const response = await window.BankAPI.customers.getAll();
      
      // Transform API data to match table format
      apiData = response.customers.map(c => [
        c.customer_id,
        c.full_name,
        c.email,
        c.credit_score,
        c.kyc_status,
        c.tier,
        c.status // Extra column for status badge
      ]);
      
      // Update original headers if necessary
      const dataRef = TABLES_DATA['customer'];
      dataRef.headers = ['Customer ID', 'Full Name', 'Email', 'Credit Score', 'KYC Status', 'Tier', 'Status'];
      dataRef.rows = apiData; // Update data source so search still works
      
    } else if (key === 'account') {
      const response = await window.BankAPI.accounts.getAll();
      
      // Transform API data to match table format
      apiData = response.accounts.map(a => [
        a.account_number,
        a.customer_id,
        a.account_type,
        a.customer_name || 'N/A', // Assuming we joined customer name in backend
        `$${a.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
        a.status
      ]);
      
      const dataRef = TABLES_DATA['account'];
      dataRef.headers = ['Account No', 'Customer ID', 'Account Type', 'Customer Name', 'Balance', 'Status'];
      dataRef.rows = apiData; // Update data source so search still works
    }
    
    // Add create button above table
    addTableActions(key);
    
    // Re-render table with new data
    renderTableDetail();
    
  } catch (err) {
    console.error(`Failed to load ${key} data:`, err);
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--color-tertiary);">Failed to load live data. Please ensure backend is running.</td></tr>`;
  }
}

function addTableActions(key) {
  const controlsDiv = document.querySelector('.table-controls');
  if (!controlsDiv || document.getElementById('btn-create-entity')) return;
  
  const createBtn = document.createElement('button');
  createBtn.id = 'btn-create-entity';
  createBtn.className = 'btn';
  createBtn.style.padding = '1rem 2rem';
  createBtn.textContent = `+ New ${key.charAt(0).toUpperCase() + key.slice(1)}`;
  
  // Insert before the back button
  const backBtn = controlsDiv.querySelector('.btn--text');
  if (backBtn) {
    controlsDiv.insertBefore(createBtn, backBtn);
  } else {
    controlsDiv.appendChild(createBtn);
  }
  
  createBtn.addEventListener('click', () => {
    if (key === 'customer') {
      window.showToast('To create a new customer, please use the Sign Up form on the homepage.', 'success');
    } else {
      window.showToast('Accounts are automatically created upon Customer Sign Up.', 'success');
    }
  });

  // Add Deposit and Withdraw Buttons for Account Table
  if (key === 'account') {
    if (!document.getElementById('btn-deposit-money')) {
      const depositBtn = document.createElement('button');
      depositBtn.id = 'btn-deposit-money';
      depositBtn.className = 'btn';
      depositBtn.style.padding = '1rem 2rem';
      depositBtn.style.marginLeft = '1rem';
      depositBtn.textContent = 'Deposit Money';
      
      if (backBtn) {
        controlsDiv.insertBefore(depositBtn, backBtn);
      } else {
        controlsDiv.appendChild(depositBtn);
      }

      depositBtn.addEventListener('click', () => openDepositModal());
    }

    if (!document.getElementById('btn-withdraw-money')) {
      const withdrawBtn = document.createElement('button');
      withdrawBtn.id = 'btn-withdraw-money';
      withdrawBtn.className = 'btn';
      withdrawBtn.style.padding = '1rem 2rem';
      withdrawBtn.style.marginLeft = '1rem';
      withdrawBtn.textContent = 'Withdraw Money';
      
      if (backBtn) {
        controlsDiv.insertBefore(withdrawBtn, backBtn);
      } else {
        controlsDiv.appendChild(withdrawBtn);
      }

      withdrawBtn.addEventListener('click', () => openWithdrawModal());
    }
  }
}

function openWithdrawModal() {
  let withdrawModal = document.getElementById('withdraw-modal');
  let overlay = document.querySelector('.overlay');
  
  if (!withdrawModal) {
    withdrawModal = document.createElement('div');
    withdrawModal.id = 'withdraw-modal';
    withdrawModal.className = 'modal';
    
    withdrawModal.innerHTML = `
      <button class="btn--close-modal" id="close-withdraw-modal">&times;</button>
      <h2 class="modal__header">
        Withdraw <span class="highlight">Money</span>
      </h2>
      <form class="modal__form" id="withdraw-form">
        <label>Account Number</label>
        <input type="text" id="withdraw-acc-no" placeholder="e.g. ACC-123456" required />
        <label>Amount ($)</label>
        <input type="number" id="withdraw-amount" placeholder="Max $10,000" min="1" max="10000" required />
        <label>PIN</label>
        <input type="password" id="withdraw-pin" placeholder="••••" required />
        <button class="btn" type="submit">Confirm Withdrawal &rarr;</button>
      </form>
    `;
    document.body.appendChild(withdrawModal);

    document.getElementById('close-withdraw-modal').addEventListener('click', () => {
      withdrawModal.classList.add('hidden');
      if (overlay) overlay.classList.add('hidden');
    });

    document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const accNo = document.getElementById('withdraw-acc-no').value;
      const amount = parseFloat(document.getElementById('withdraw-amount').value);
      const pin = document.getElementById('withdraw-pin').value;
      const btn = e.target.querySelector('button');
      
      const originalText = btn.textContent;
      btn.textContent = 'Processing...';
      btn.disabled = true;

      try {
        await window.BankAPI.accounts.withdraw(accNo, amount, 'Online Withdrawal', pin);
        window.showToast(`Successfully withdrew $${amount} from ${accNo}`, 'success');
        
        withdrawModal.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');
        
        // Refresh table
        interceptTableRendering('account');
      } catch (err) {
        window.showToast(err.message, 'error');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }

  withdrawModal.classList.remove('hidden');
  if (overlay) overlay.classList.remove('hidden');
}

function openDepositModal() {
  let depositModal = document.getElementById('deposit-modal');
  let overlay = document.querySelector('.overlay');
  
  if (!depositModal) {
    depositModal = document.createElement('div');
    depositModal.id = 'deposit-modal';
    depositModal.className = 'modal';
    
    depositModal.innerHTML = `
      <button class="btn--close-modal" id="close-deposit-modal">&times;</button>
      <h2 class="modal__header">
        Deposit <span class="highlight">Money</span>
      </h2>
      <form class="modal__form" id="deposit-form">
        <label>Account Number</label>
        <input type="text" id="deposit-acc-no" placeholder="e.g. ACC-123456" required />
        <label>Amount ($)</label>
        <input type="number" id="deposit-amount" placeholder="Max $10,000" min="1" max="10000" required />
        <label>PIN</label>
        <input type="password" id="deposit-pin" placeholder="••••" required />
        <button class="btn" type="submit">Confirm Deposit &rarr;</button>
      </form>
    `;
    document.body.appendChild(depositModal);

    document.getElementById('close-deposit-modal').addEventListener('click', () => {
      depositModal.classList.add('hidden');
      if (overlay) overlay.classList.add('hidden');
    });

    document.getElementById('deposit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const accNo = document.getElementById('deposit-acc-no').value;
      const amount = parseFloat(document.getElementById('deposit-amount').value);
      const pin = document.getElementById('deposit-pin').value;
      const btn = e.target.querySelector('button');
      
      const originalText = btn.textContent;
      btn.textContent = 'Processing...';
      btn.disabled = true;

      try {
        await window.BankAPI.accounts.deposit(accNo, amount, 'Online Deposit', pin);
        window.showToast(`Successfully deposited $${amount} into ${accNo}`, 'success');
        
        depositModal.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');
        
        // Refresh table
        interceptTableRendering('account');
      } catch (err) {
        window.showToast(err.message, 'error');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }

  depositModal.classList.remove('hidden');
  if (overlay) overlay.classList.remove('hidden');
}
