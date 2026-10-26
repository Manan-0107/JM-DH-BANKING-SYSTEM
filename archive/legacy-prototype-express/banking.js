'use strict';

// Ensure this script runs after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const langToggleBtn = document.getElementById('lang-toggle');
  let currentLanguage = langToggleBtn && langToggleBtn.textContent.includes('हिंदी') ? 'en' : 'hi';

  // Attach real API calls to forms, removing inline onsubmit alert()
  if (formLogin) {
    // Remove the inline onsubmit attribute
    formLogin.removeAttribute('onsubmit');
    
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const inputs = formLogin.querySelectorAll('input');
      const email = inputs[0].value;
      const password = inputs[1].value;
      const btn = formLogin.querySelector('button');
      
      const originalText = btn.textContent;
      btn.textContent = 'Authenticating...';
      btn.disabled = true;

      try {
        const response = await window.BankAPI.auth.login(email, password);
        window.BankAPI.setToken(response.token);
        
        window.showToast(`Welcome back, ${response.customer.full_name.split(' ')[0]}!`, 'success');
        
        // Refresh dashboard if it exists
        if (window.loadDashboardStats) {
          window.loadDashboardStats();
        }
        
        // Clear form
        inputs[0].value = '';
        inputs[1].value = '';
        
      } catch (err) {
        window.showToast(err.message, 'error');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }

  if (formSignup) {
    // Remove the inline onsubmit attribute
    formSignup.removeAttribute('onsubmit');
    
    formSignup.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const inputs = formSignup.querySelectorAll('input');
      const full_name = inputs[0].value;
      const email = inputs[1].value;
      const password = inputs[2].value;
      const btn = formSignup.querySelector('button');
      
      const originalText = btn.textContent;
      btn.textContent = 'Creating account...';
      btn.disabled = true;

      try {
        const response = await window.BankAPI.auth.signup({ full_name, email, password });
        window.BankAPI.setToken(response.token);
        
        window.showToast('Account created successfully!', 'success');
        
        // Refresh dashboard if it exists
        if (window.loadDashboardStats) {
          window.loadDashboardStats();
        }
        
        // Clear form
        inputs[0].value = '';
        inputs[1].value = '';
        inputs[2].value = '';
        
      } catch (err) {
        window.showToast(err.message, 'error');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }

  // Handle the modal open account form
  const modalForm = document.querySelector('.modal__form');
  if (modalForm) {
    modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const inputs = modalForm.querySelectorAll('input');
      const firstName = inputs[0].value;
      const lastName = inputs[1].value;
      const email = inputs[2].value;
      const full_name = `${firstName} ${lastName}`.trim();
      const btn = modalForm.querySelector('button');
      
      if (!firstName || !lastName || !email) {
        window.showToast('Please fill all fields', 'error');
        return;
      }
      
      const originalText = btn.textContent;
      btn.textContent = 'Processing...';
      btn.disabled = true;
      
      try {
        // Create account via API (we use 1234 as default pin for modal signups)
        const response = await window.BankAPI.auth.signup({ full_name, email, password: '1234' });
        window.BankAPI.setToken(response.token);
        
        window.showToast(`Account created! Default PIN is 1234.`, 'success');
        
        // Close modal
        document.querySelector('.btn--close-modal').click();
        
        // Clear form
        inputs.forEach(input => input.value = '');
        
        // Refresh dashboard if it exists
        if (window.loadDashboardStats) {
          window.loadDashboardStats();
        }
      } catch (err) {
        window.showToast(err.message, 'error');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }
});
