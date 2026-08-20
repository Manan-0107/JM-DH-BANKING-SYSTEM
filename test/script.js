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
// GOOGLE TRANSLATE WIDGET & INSTANT EN/HI TOGGLE BUTTON
// ============================================================
// ============================================================
// GOOGLE TRANSLATE WIDGET & INSTANT EN/HI TOGGLE BUTTON
// ============================================================
const TRANSLATION_MAP = {
  "Home": "होम",
  "Account": "खाता",
  "Personal": "व्यक्तिगत",
  "Personal Details": "व्यक्तिगत विवरण",
  "Loan": "ऋण",
  "Log Out": "लॉग आउट",
  "Log Out →": "लॉग आउट →",
  "Log In": "लॉग इन",
  "Sign Up": "साइन अप",
  "Welcome Back": "वापसी पर आपका स्वागत है",
  "User ID / Email": "यूजर आईडी / ईमेल",
  "PIN / Password": "पिन / पासवर्ड",
  "Get Started Today": "आज ही शुरू करें",
  "Full Name": "पूरा नाम",
  "LOG IN →": "लॉग इन →",
  "SIGN UP →": "साइन अप →",
  "When banking meets minimalist": "जब बैंकिंग सादगी से मिलती है",
  "A simpler banking experience for a simpler life.": "सरल जीवन के लिए एक सरल बैंकिंग अनुभव।",
  "High-Yield Savings": "उच्च-ब्याज बचत",
  "Business Checking": "व्यावसायिक चेकिंग",
  "Student Advantage": "छात्र लाभ",
  "International Treasury": "अंतरराष्ट्रीय खजाना",
  "Instant Account Creation": "तत्काल खाता निर्माण",
  "Home Mortgage Loan": "गृह बंधक ऋण",
  "Electric Vehicle Loan": "इलेक्ट्रिक वाहन ऋण",
  "Small Business Financing": "छोटे व्यवसाय का वित्तपोषण",
  "Commercial Property Loan": "वाणिज्यिक संपत्ति ऋण",
  "Personal Credit Line": "व्यक्तिगत क्रेडिट लाइन",
  "Open account": "खाता खोलें",
  "FEATURES": "विशेषताएं",
  "Everything you need in a modern bank": "एक आधुनिक बैंक में आपकी आवश्यकता की हर चीज",
  "OPERATIONS": "संचालन",
  "Simpler. Faster. Seamless.": "सरल। तेज। निर्बाध।",
  "TESTIMONIALS": "प्रशंसापत्र",
  "Not sure yet? Thousands of happy bankists already have accounts": "अभी भी अनिश्चित हैं? हजारों खुश ग्राहक पहले से ही खातों का उपयोग कर रहे हैं"
};

const REVERSE_TRANSLATION_MAP = {};
Object.keys(TRANSLATION_MAP).forEach(key => {
  REVERSE_TRANSLATION_MAP[TRANSLATION_MAP[key]] = key;
});

function applyDictionaryTranslation(lang) {
  const walkNodes = function(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (!text) return;
      if (lang === 'hi') {
        if (TRANSLATION_MAP[text]) {
          if (!node._originalEn) node._originalEn = node.textContent;
          node.textContent = node.textContent.replace(text, TRANSLATION_MAP[text]);
        }
      } else if (lang === 'en') {
        if (node._originalEn) {
          node.textContent = node._originalEn;
        } else if (REVERSE_TRANSLATION_MAP[text]) {
          node.textContent = node.textContent.replace(text, REVERSE_TRANSLATION_MAP[text]);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.id === 'google_translate_element' || node.tagName === 'INPUT') return;
      for (let child of node.childNodes) {
        walkNodes(child);
      }
    }
  };
  walkNodes(document.body || document.documentElement);
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

  // Hide Google Translate top navbar iframe & reset body top offset
  const hideGoogleBanner = function () {
    const frame = document.querySelector('.goog-te-banner-frame');
    if (frame) {
      frame.style.display = 'none';
      frame.style.visibility = 'hidden';
    }
    if (document.body && document.body.style.top !== '0px') {
      document.body.style.top = '0px';
    }
  };
  setInterval(hideGoogleBanner, 300);

  const savedLang = getActiveLanguage();
  if (savedLang === 'hi') {
    applyLanguageToCombo('hi');
  }
};

function getActiveLanguage() {
  return localStorage.getItem('userLanguage') || 'en';
}

function updateLangBtnText(lang) {
  const btn = document.getElementById('lang-toggle-btn');
  if (btn) {
    btn.textContent = lang === 'hi' ? '🌐 हिंदी / EN' : '🌐 EN / हिंदी';
  }
}

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function clearTransCookies() {
  document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "googtrans=/en/en; path=/;";
}

function applyLanguageToCombo(targetLang) {
  const combo = document.querySelector('.goog-te-combo');
  if (combo) {
    if (targetLang === 'hi') {
      if (combo.value !== 'hi') {
        combo.value = 'hi';
        combo.dispatchEvent(new Event('change'));
      }
    } else {
      if (combo.value !== '' && combo.value !== 'en') {
        combo.value = '';
        if (combo.selectedIndex !== 0) combo.selectedIndex = 0;
        combo.dispatchEvent(new Event('change'));
      }
    }
    return true;
  }
  return false;
}

function ensureAndApplyLanguage(targetLang) {
  if (applyLanguageToCombo(targetLang)) return;

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (applyLanguageToCombo(targetLang) || attempts > 25) {
      clearInterval(interval);
    }
  }, 60);
}

function switchLanguage(targetLang) {
  updateLangBtnText(targetLang);

  if (targetLang === 'hi') {
    localStorage.setItem('userLanguage', 'hi');
    setCookie('googtrans', '/en/hi', 30);
    ensureAndApplyLanguage('hi');
    applyDictionaryTranslation('hi');
  } else {
    localStorage.setItem('userLanguage', 'en');
    clearTransCookies();
    ensureAndApplyLanguage('en');
    applyDictionaryTranslation('en');
  }
}

function initLanguageState() {
  const currentLang = getActiveLanguage();
  updateLangBtnText(currentLang);

  if (currentLang === 'hi') {
    setCookie('googtrans', '/en/hi', 30);
    ensureAndApplyLanguage('hi');
    applyDictionaryTranslation('hi');
  } else {
    clearTransCookies();
  }

  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) {
    langBtn.onclick = function (e) {
      e.preventDefault();
      const activeLang = getActiveLanguage();
      const nextLang = activeLang === 'en' ? 'hi' : 'en';
      switchLanguage(nextLang);
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanguageState);
} else {
  initLanguageState();
}

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

