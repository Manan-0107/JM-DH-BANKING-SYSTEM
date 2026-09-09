'use strict'

const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const btnCloseModal = document.querySelector('.btn--close-modal');
const btnsOpenModal = document.querySelectorAll('.btn--show-modal');

const openModal = function (e) {
  if (e) e.preventDefault();
  if (modal) modal.classList.remove('hidden');
  if (overlay) overlay.classList.remove('hidden');
};

const closeModal = function () {
  if (modal) modal.classList.add('hidden');
  if (overlay) overlay.classList.add('hidden');
};

if (btnsOpenModal) {
  btnsOpenModal.forEach(b => b.addEventListener('click', openModal));
}

// Nav Dropdown Click & Outside Click Close
document.addEventListener('click', function (e) {
  const dropdowns = document.querySelectorAll('.nav__item--dropdown');
  dropdowns.forEach(item => {
    const toggleBtn = item.querySelector('.nav__link');
    const isToggleClick = toggleBtn && toggleBtn.contains(e.target);
    const isInsideDropdown = item.contains(e.target);

    if (isToggleClick) {
      e.preventDefault();
      dropdowns.forEach(d => { if (d !== item) d.classList.remove('active'); });
      item.classList.toggle('active');
    } else if (!isInsideDropdown || e.target.closest('.dropdown__link')) {
      item.classList.remove('active');
    }
  });
});

if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
if (overlay) overlay.addEventListener('click', closeModal);

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
    closeModal();
  }
});

// Selecting elements
/*console.log(document.documentElement);
console.log(document.head);
console.log(document.body);

const header = document.querySelector('.header');
const allSections = document.querySelectorAll('.section');
console.log(allSections);

document.getElementById('section--1');
const allButtons = document.getElementsByTagName('button'); // element with button name will be selected
// we can delete button from html collections and also add button to it but we cannot do same to Nodelist
console.log(allButtons);

console.log(document.getElementsByClassName('btn'));


// Creating and inserting elements
// .insertAdjacentHTML
const message = document.createElement('div');
message.classList.add('cookie-message');
message.textContent = 'We use cookied for improved functionality and analytics';
message.innerHTML = 'We use cooked for improved functionality and analytics.<button class="btn btn--close--cookie">Got it!</button>';

header.prepend(message); // added as the first child of header
header.append(message); // added as the last child of header
// the element message is added only once as it's considered as a life element of DOM tree whether it be first or last it totally depend on the type of operation we choose to perform

// This way you can copy element and add multiple copies
header.append(message.cloneNode(true));
header.before(message);
header.after(message);

// Delete elements 
document.querySelector('.btn--close--cookie').addEventListener('click',function(){
    message.remove();
    message.parentElement.removeChild(message);
})
message.style.backgroundColor = '#37383d';
message.style.width = '120%';
console.log(message.style.height); // will print nothing
console.log(message.style.backgroundColor);
console.log(getComputedStyle(message).color);
console.log(getComputedStyle(message).height);

message.style.height = Number.parseFloat(getComputedStyle(message).height) + 40 + 'px';

document.documentElement.style.setProperty('--color-primary', ' orangered');  

const logo = document.querySelector('.nav__logo');
console.log(logo.alt);
console.log(logo.src);
console.log(logo.className);

logo.alt = 'Beautiful minimalist logo';

console.log(logo.designer);
console.log(logo.getAttribute('designer'));
logo.setAttribute('company' , 'Bankist');

*/
const btnScrollTo = document.querySelector('.btn--scroll-to');
const section1 = document.querySelector('#section--1');
if (btnScrollTo && section1) {
  btnScrollTo.addEventListener('click', function (e) {
    section1.scrollIntoView({ behaviour: 'smooth' });
  });
}


/*const h1 = document.querySelector('hi');
const alertH1 = function(e){
  alert('addEventListener: Great! You are reading the heading :D');
  h1.removeEventListener('mouseenter',alertH1);
};
h1.addEventListener('mouseenter' ,alertH1);

// on  event property
h1.onmouseenter = function(e){
  alert('onmouseenter: Great! You are reading the heading :D');
}

setTimeout(() => h1.removeEventListener('mouseenter',alertH1),3000);*/

/*const randomInt = (min,max) => Math.floor(Math.random() * (max-min+1) + min);

const randomColor =() => `rgb(${randomInt(0,255)},${randomInt(0,255)},${randomInt(0,255)})`;

console.log(randomColor(0,255));

document.querySelector('.nav__link').addEventListener('click',function(e){
this.style.backgroundColor = randomColor();
})

document.querySelector('.nav__links').addEventListener('click',function(e){
  this.style.backgroundColor = randomColor();
},true)*/

// ============================================================
// HEADER LOGIN/SIGNUP FORM & LANGUAGE SWITCHER
// ============================================================

// Form tab switching (Log In vs Sign Up)
const tabContainer = document.querySelector('.form__tab-container');
const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');

if (tabContainer) {
  tabContainer.addEventListener('click', function (e) {
    const clicked = e.target.closest('.form__tab');
    if (!clicked) return;

    document.querySelectorAll('.form__tab').forEach(t => t.classList.remove('form__tab--active'));
    clicked.classList.add('form__tab--active');

    const authTab = clicked.dataset.authTab;
    if (authTab === 'login') {
      formLogin.classList.remove('hidden');
      formSignup.classList.add('hidden');
    } else {
      formLogin.classList.add('hidden');
      formSignup.classList.remove('hidden');
    }
  });
}

// ============================================================
// GOOGLE TRANSLATE ENGINE & INSTANT EN/HI TOGGLE BUTTON
// ============================================================
function setGoogleTransCookie(targetLang) {
  const cookieVal = targetLang === 'hi' ? '/en/hi' : '/en/en';
  const expires = "; expires=" + new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  const pastExpires = "; expires=Thu, 01 Jan 1970 00:00:00 UTC";

  document.cookie = "googtrans=" + cookieVal + expires + "; path=/";
  if (location.hostname && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    document.cookie = "googtrans=" + cookieVal + expires + "; domain=" + location.hostname + "; path=/";
  }

  if (targetLang === 'en') {
    document.cookie = "googtrans=" + pastExpires + "; path=/";
    document.cookie = "googtrans=" + pastExpires + "; path=/; domain=" + location.hostname;
    document.cookie = "googtrans=/en/en" + expires + "; path=/";
  }
}

function triggerGoogleTranslate(targetLang) {
  const desiredVal = targetLang === 'hi' ? 'hi' : 'en';
  const combo = document.querySelector('.goog-te-combo');
  if (combo) {
    combo.value = desiredVal;
    combo.dispatchEvent(new Event('change'));
    combo.dispatchEvent(new Event('input'));
  }
}

function updateLangBtnText(lang) {
  const btn = document.getElementById('lang-toggle-btn');
  if (btn) {
    btn.textContent = lang === 'hi' ? '🌐 हिंदी / EN' : '🌐 EN / हिंदी';
  }
}

function toggleLanguage() {
  const currentLang = localStorage.getItem('userLanguage') || 'en';
  const nextLang = currentLang === 'en' ? 'hi' : 'en';

  localStorage.setItem('userLanguage', nextLang);
  setGoogleTransCookie(nextLang);
  updateLangBtnText(nextLang);
  triggerGoogleTranslate(nextLang);

  setTimeout(() => {
    location.reload();
  }, 50);
}

window.googleTranslateElementInit = function () {
  if (window.google && window.google.translate) {
    new window.google.translate.TranslateElement(
      {
        pageLanguage: 'en',
        includedLanguages: 'en,hi',
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      },
      'google_translate_element'
    );
  }

  // Suppress all Google Translate popups, top banner frames & keep body top at 0px
  const hidePopups = function () {
    const popups = document.querySelectorAll(
      '.goog-te-banner-frame, iframe.goog-te-banner-frame, #goog-gt-tt, .goog-te-balloon-frame, .VIpgJd-ZGain-Ovf-oZ24-wZ38ld, .VIpgJd-yLiTe-l4e-yLiTe'
    );
    popups.forEach(el => {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
    if (document.body && document.body.style.top !== '0px') {
      document.body.style.top = '0px';
    }
  };
  setInterval(hidePopups, 150);

  const activeLang = localStorage.getItem('userLanguage') || 'en';
  updateLangBtnText(activeLang);
  if (activeLang === 'hi') {
    triggerGoogleTranslate('hi');
  }
};

document.addEventListener('click', function (e) {
  const langBtn = e.target.closest('#lang-toggle-btn');
  if (langBtn) {
    e.preventDefault();
    toggleLanguage();
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const activeLang = localStorage.getItem('userLanguage') || 'en';
  updateLangBtnText(activeLang);
});

// ============================================================
// LOGIN / AUTHENTICATION & PERSONAL SECTION VISIBILITY
// ============================================================
const sectionPersonal = document.getElementById('section--2');
const navItemPersonal = document.getElementById('nav-item-personal');
const navItemLogout = document.getElementById('nav-item-logout');
const navBtnLogout = document.getElementById('nav-btn-logout');
const headerFormContainer = document.querySelector('.header__form-container');
const headerTitle = document.querySelector('.header__title');
const inputUsername = document.getElementById('input-username');
const inputFullname = document.getElementById('input-fullname');

function updateAuthState(isLoggedIn, username = 'User') {
  if (isLoggedIn) {
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('username', username);

    document.documentElement.classList.add('is-logged-in');
    if (document.body) document.body.classList.add('is-logged-in');

    // Completely hide login and signup page/container after login
    if (headerFormContainer) {
      headerFormContainer.classList.add('d-none');
      headerFormContainer.style.setProperty('display', 'none', 'important');
      headerFormContainer.hidden = true;
    }
    if (headerTitle) headerTitle.classList.add('header__title--logged-in');

    // Show Personal section, Personal nav link, and Logout button in navigation bar
    if (sectionPersonal) sectionPersonal.classList.remove('d-none');
    if (navItemPersonal) navItemPersonal.classList.remove('d-none');
    if (navItemLogout) navItemLogout.classList.remove('d-none');
  } else {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('username');

    document.documentElement.classList.remove('is-logged-in');
    if (document.body) document.body.classList.remove('is-logged-in');

    // Show login/signup form container when logged out
    if (headerFormContainer) {
      headerFormContainer.classList.remove('d-none');
      headerFormContainer.style.removeProperty('display');
      headerFormContainer.hidden = false;
    }
    if (headerTitle) headerTitle.classList.remove('header__title--logged-in');

    // Reset forms visibility according to active tab
    const activeTab = document.querySelector('.form__tab--active');
    const authTab = activeTab ? activeTab.dataset.authTab : 'login';
    if (authTab === 'login') {
      if (formLogin) formLogin.classList.remove('hidden');
      if (formSignup) formSignup.classList.add('hidden');
    } else {
      if (formLogin) formLogin.classList.add('hidden');
      if (formSignup) formSignup.classList.remove('hidden');
    }

    // Hide Personal section & Logout nav item
    if (sectionPersonal) sectionPersonal.classList.add('d-none');
    if (navItemPersonal) navItemPersonal.classList.add('d-none');
    if (navItemLogout) navItemLogout.classList.add('d-none');
  }
}

// Immediate execution check at script load time
if (sessionStorage.getItem('isLoggedIn') === 'true') {
  document.documentElement.classList.add('is-logged-in');
  if (document.body) document.body.classList.add('is-logged-in');
}

// Observe any unintended style/class mutations on headerFormContainer (e.g. from Google Translate)
if (headerFormContainer) {
  const observer = new MutationObserver(() => {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
      if (headerFormContainer.style.display !== 'none') {
        headerFormContainer.style.setProperty('display', 'none', 'important');
        headerFormContainer.hidden = true;
      }
    }
  });
  observer.observe(headerFormContainer, { attributes: true, attributeFilter: ['style', 'class'] });
}

const inputPin = document.getElementById('input-pin');

// Attach Form Submit Handlers
if (formLogin) {
  formLogin.addEventListener('submit', function (e) {
    e.preventDefault();
    const uname = inputUsername ? inputUsername.value.trim() : '';
    const pin = inputPin ? inputPin.value.trim() : '';

    // Validate inputs (e.g. valid Username and 4+ digit PIN)
    const isValid = uname.length >= 2 && pin.length >= 4;

    if (!isValid) {
      // Trigger Shake Animation
      if (headerFormContainer) {
        headerFormContainer.classList.remove('shake');
        void headerFormContainer.offsetWidth; // Force CSS reflow
        headerFormContainer.classList.add('shake');

        setTimeout(() => {
          headerFormContainer.classList.remove('shake');
        }, 550);
      }

      // Highlight erroneous fields
      if (inputUsername && uname.length < 2) {
        inputUsername.classList.add('input-error');
      } else if (inputUsername) {
        inputUsername.classList.remove('input-error');
      }

      if (inputPin && pin.length < 4) {
        inputPin.classList.add('input-error');
      } else if (inputPin) {
        inputPin.classList.remove('input-error');
      }
      return;
    }

    // Clear error state on successful validation
    if (inputUsername) inputUsername.classList.remove('input-error');
    if (inputPin) inputPin.classList.remove('input-error');

    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('username', uname);
    
    // Redirect to personal details web page in the SAME TAB
    window.location.href = 'personal.html';
  });
}

// Clear error highlight when typing
[inputUsername, inputPin].forEach(input => {
  if (input) {
    input.addEventListener('input', () => {
      input.classList.remove('input-error');
    });
  }
});

if (formSignup) {
  formSignup.addEventListener('submit', function (e) {
    e.preventDefault();
    const uname = inputFullname && inputFullname.value.trim() ? inputFullname.value.trim() : 'User';
    
    alert('🎉 Account created successfully!\n\nPlease log in with your credentials to view your personal details page.');
    
    // Switch to Log In tab and pre-fill User ID
    document.querySelectorAll('.form__tab').forEach(t => t.classList.remove('form__tab--active'));
    const tabLoginBtn = document.getElementById('tab-login-btn');
    if (tabLoginBtn) tabLoginBtn.classList.add('form__tab--active');
    
    if (formLogin) formLogin.classList.remove('hidden');
    if (formSignup) formSignup.classList.add('hidden');
    if (inputUsername) {
      inputUsername.value = uname;
      inputUsername.focus();
    }
  });
}

if (navBtnLogout) {
  navBtnLogout.addEventListener('click', function () {
    updateAuthState(false);
    window.location.href = 'index.html';
  });
}

// Initial Session Check
const initAuth = function () {
  const savedLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  const savedUser = sessionStorage.getItem('username') || 'User';
  updateAuthState(savedLoggedIn, savedUser);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}

// ============================================================
// ACCOUNT FIELDS AUTHENTICATION CONSTRAINT
// ============================================================
document.addEventListener('click', function (e) {
  const accountTarget = e.target.closest('a[href*="account.html"], a[href*="table=account"], #nav-account-btn, [data-table="account"]');
  if (accountTarget) {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      e.preventDefault();
      e.stopPropagation();
      alert("⚠️ Access Restricted: You need to log in first to access Account features and details.");
      
      const headerFormContainer = document.querySelector('.header__form-container');
      if (headerFormContainer && !headerFormContainer.classList.contains('d-none') && headerFormContainer.style.display !== 'none') {
        headerFormContainer.scrollIntoView({ behavior: 'smooth' });
        headerFormContainer.classList.remove('shake');
        void headerFormContainer.offsetWidth;
        headerFormContainer.classList.add('shake');
        const uInput = document.getElementById('input-username');
        if (uInput) uInput.focus();
      } else {
        window.location.href = 'index.html?loginRequired=true';
      }
    }
  }
}, true);

// Check if redirected with loginRequired parameter
const checkLoginRequiredParam = function () {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('loginRequired') && sessionStorage.getItem('isLoggedIn') !== 'true') {
    const headerFormContainer = document.querySelector('.header__form-container');
    if (headerFormContainer) {
      headerFormContainer.scrollIntoView({ behavior: 'smooth' });
      const uInput = document.getElementById('input-username');
      if (uInput) uInput.focus();
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkLoginRequiredParam);
} else {
  checkLoginRequiredParam();
}

// ============================================================
// SMART AMORTIZATION & EMI CALCULATOR ENGINE & MODAL
// ============================================================
const CalculatorEngine = {
  calculateAmortization(principal, annualRate, tenureYears) {
    const p = parseFloat(principal) || 0;
    const rate = parseFloat(annualRate) || 0;
    const years = parseFloat(tenureYears) || 0;

    const totalMonths = Math.max(1, Math.round(years * 12));
    const monthlyRate = rate / 12 / 100;

    let emi = 0;
    if (monthlyRate > 0) {
      emi = (p * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    } else {
      emi = p / totalMonths;
    }

    const totalPayment = emi * totalMonths;
    const totalInterest = Math.max(0, totalPayment - p);

    const schedule = [];
    let balance = p;
    let accumulatedInterest = 0;
    let accumulatedPrincipal = 0;

    for (let month = 1; month <= totalMonths; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = Math.min(balance, emi - interestPayment);
      balance = Math.max(0, balance - principalPayment);

      accumulatedInterest += interestPayment;
      accumulatedPrincipal += principalPayment;

      if (month % 12 === 0 || month === totalMonths) {
        const yearNum = Math.ceil(month / 12);
        schedule.push({
          year: `Year ${yearNum}`,
          month: month,
          principalPaid: accumulatedPrincipal,
          interestPaid: accumulatedInterest,
          balance: balance
        });
      }
    }

    return {
      emi: Math.round(emi),
      totalPayment: Math.round(totalPayment),
      totalInterest: Math.round(totalInterest),
      totalMonths: totalMonths,
      schedule: schedule
    };
  },

  formatCurrency(num) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  },

  ensureModalContainer() {
    if (document.getElementById('calc-modal-overlay')) return;

    const modalHtml = `
      <div id="calc-modal-overlay" class="modal-calc-overlay hidden">
        <div class="modal-calc-window">
          <button class="modal-calc__close" id="calc-modal-close" aria-label="Close Calculator">&times;</button>
          
          <div class="modal-calc__header">
            <h3 class="modal-calc__title">🧮 Smart Amortization & EMI Calculator</h3>
            <p class="modal-calc__subtitle">Calculate your exact monthly EMI, total interest, and annual balance breakdown schedule.</p>
          </div>

          <div class="modal-calc__grid">
            <div class="calc-inputs-col">
              <div class="calc-input-group">
                <label for="calc-slider-principal">
                  <span>Loan Amount (Principal)</span>
                  <span class="calc-input-val" id="calc-val-principal">₹500,000</span>
                </label>
                <input type="range" id="calc-slider-principal" class="calc-range-slider" min="10000" max="10000000" step="10000" value="500000" />
              </div>

              <div class="calc-input-group">
                <label for="calc-slider-rate">
                  <span>Annual Interest Rate (%)</span>
                  <span class="calc-input-val" id="calc-val-rate">5.5%</span>
                </label>
                <input type="range" id="calc-slider-rate" class="calc-range-slider" min="1.0" max="20.0" step="0.1" value="5.5" />
              </div>

              <div class="calc-input-group">
                <label for="calc-slider-tenure">
                  <span>Loan Tenure (Years)</span>
                  <span class="calc-input-val" id="calc-val-tenure">15 Years</span>
                </label>
                <input type="range" id="calc-slider-tenure" class="calc-range-slider" min="1" max="30" step="1" value="15" />
              </div>
            </div>

            <div class="calc-results-box">
              <div class="calc-res-item">
                <div class="calc-res-label">Monthly EMI Payment</div>
                <div class="calc-res-value" id="res-calc-emi">₹4,085 / mo</div>
              </div>

              <div class="calc-res-item">
                <div class="calc-res-label">Total Interest Payable</div>
                <div class="calc-res-value calc-res-value--secondary" id="res-calc-interest">₹235,389</div>
              </div>

              <div class="calc-res-item">
                <div class="calc-res-label">Total Repayment (Principal + Interest)</div>
                <div class="calc-res-value calc-res-value--secondary" id="res-calc-total">₹735,389</div>
              </div>
            </div>
          </div>

          <div class="modal-calc__schedule">
            <h4 class="modal-calc__schedule-title">📊 Annual Amortization Schedule Breakdown</h4>
            <div class="calc-schedule-table-wrap">
              <table class="calc-schedule-table">
                <thead>
                  <tr>
                    <th>Timeline</th>
                    <th>Cumulative Principal Paid</th>
                    <th>Cumulative Interest Paid</th>
                    <th>Remaining Balance</th>
                  </tr>
                </thead>
                <tbody id="calc-schedule-tbody">
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.bindEvents();
  },

  bindEvents() {
    const overlay = document.getElementById('calc-modal-overlay');
    const closeBtn = document.getElementById('calc-modal-close');

    if (closeBtn) closeBtn.onclick = () => this.closeModal();
    if (overlay) {
      overlay.onclick = (e) => {
        if (e.target === overlay) this.closeModal();
      };
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });

    const sliderPrincipal = document.getElementById('calc-slider-principal');
    const sliderRate = document.getElementById('calc-slider-rate');
    const sliderTenure = document.getElementById('calc-slider-tenure');

    const updateCalc = () => {
      const p = sliderPrincipal.value;
      const r = sliderRate.value;
      const t = sliderTenure.value;

      document.getElementById('calc-val-principal').textContent = this.formatCurrency(p);
      document.getElementById('calc-val-rate').textContent = `${parseFloat(r).toFixed(1)}%`;
      document.getElementById('calc-val-tenure').textContent = `${t} Year${t > 1 ? 's' : ''}`;

      const res = this.calculateAmortization(p, r, t);

      document.getElementById('res-calc-emi').textContent = `${this.formatCurrency(res.emi)} / mo`;
      document.getElementById('res-calc-interest').textContent = this.formatCurrency(res.totalInterest);
      document.getElementById('res-calc-total').textContent = this.formatCurrency(res.totalPayment);

      const tbody = document.getElementById('calc-schedule-tbody');
      if (tbody) {
        tbody.innerHTML = res.schedule
          .map(
            s => `
            <tr>
              <td><strong>${s.year}</strong> (Month ${s.month})</td>
              <td>${this.formatCurrency(s.principalPaid)}</td>
              <td>${this.formatCurrency(s.interestPaid)}</td>
              <td><strong>${this.formatCurrency(s.balance)}</strong></td>
            </tr>`
          )
          .join('');
      }
    };

    if (sliderPrincipal) sliderPrincipal.oninput = updateCalc;
    if (sliderRate) sliderRate.oninput = updateCalc;
    if (sliderTenure) sliderTenure.oninput = updateCalc;
  },

  openModal(defaultPrincipal = 500000, defaultRate = 5.5, defaultTenure = 15) {
    this.ensureModalContainer();

    const sliderPrincipal = document.getElementById('calc-slider-principal');
    const sliderRate = document.getElementById('calc-slider-rate');
    const sliderTenure = document.getElementById('calc-slider-tenure');

    if (sliderPrincipal) sliderPrincipal.value = defaultPrincipal;
    if (sliderRate) sliderRate.value = defaultRate;
    if (sliderTenure) sliderTenure.value = defaultTenure;

    if (sliderPrincipal) sliderPrincipal.oninput();

    const overlay = document.getElementById('calc-modal-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }
  },

  closeModal() {
    const overlay = document.getElementById('calc-modal-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }
};

document.addEventListener('click', (e) => {
  const calcCard = e.target.closest('[data-action="open-calc"]') || e.target.closest('.feature-card');
  if (calcCard) {
    const title = calcCard.querySelector('.feature-card__title')?.textContent || '';
    if (title.toLowerCase().includes('amortization') || title.toLowerCase().includes('calculator') || title.toLowerCase().includes('loan') || title.toLowerCase().includes('yield') || title.toLowerCase().includes('goal')) {
      e.preventDefault();
      CalculatorEngine.openModal(500000, 5.5, 15);
    }
  }
});


