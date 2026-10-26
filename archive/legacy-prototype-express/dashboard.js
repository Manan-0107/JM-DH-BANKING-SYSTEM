'use strict';

/**
 * Loads aggregated stats from the backend and updates the landing page table cards
 */
async function loadDashboardStats() {
  try {
    const data = await window.BankAPI.dashboard.get();
    
    if (data && data.summary) {
      // Find cards by data-table attribute and update their metadata text
      
      // Update Customer count
      const customerCard = document.querySelector('.table-card[data-table="customer"]');
      if (customerCard) {
        let meta = customerCard.querySelector('.table-card__meta');
        if (!meta) {
          meta = document.createElement('p');
          meta.className = 'table-card__meta';
          customerCard.appendChild(meta);
        }
        meta.textContent = `${data.summary.totalCustomers} Registered Customers`;
      }
      
      // Update Account count
      const accountCard = document.querySelector('.table-card[data-table="account"]');
      if (accountCard) {
        let meta = accountCard.querySelector('.table-card__meta');
        if (!meta) {
          meta = document.createElement('p');
          meta.className = 'table-card__meta';
          accountCard.appendChild(meta);
        }
        meta.textContent = `${data.summary.totalAccounts} Active Accounts`;
      }

      // We can also add a total balance to the branch card to show total vault reserve
      const branchCard = document.querySelector('.table-card[data-table="branch"]');
      if (branchCard) {
        let meta = branchCard.querySelector('.table-card__meta');
        if (!meta) {
          meta = document.createElement('p');
          meta.className = 'table-card__meta';
          branchCard.appendChild(meta);
        }
        meta.textContent = `Total Deposits: $${data.summary.totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard stats:', err);
  }
}

// Make it globally available so banking.js can call it after login
window.loadDashboardStats = loadDashboardStats;

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
  loadDashboardStats();
});
