'use strict'

const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const btnCloseModal = document.querySelector('.btn--close-modal');
const btnsOpenModal = document.querySelectorAll('.btn--show-modal');

const openModal = function (e) {
  e.preventDefault();
  modal.classList.remove('hidden');
  overlay.classList.remove('hidden');
};

const closeModal = function () {
  modal.classList.add('hidden');
  overlay.classList.add('hidden');
};

btnsOpenModal.forEach(b => b.addEventListener('click', openModal));

// Nav Account Dropdown Click Toggle
document.querySelectorAll('.nav__item--dropdown').forEach(item => {
  const toggleBtn = item.querySelector('#nav-account-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', e => {
      e.preventDefault();
      item.classList.toggle('active');
    });
  }
});
/*for (let i = 0; i < btnsOpenModal.length; i++)
  btnsOpenModal[i].addEventListener('click', openModal);*/

btnCloseModal.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
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
btnScrollTo.addEventListener('click', function (e) {
  const s1coords = section1.getBoundingClientRect();
  console.log(s1coords);
  console.log(e.target.getBoundingClientRect());
  console.log('Current scroll (X/Y)', window.pageXOffset, window.pageYOffset);
  console.log('height/width viewport', document.documentElement.clientHeight, document.documentElement.clientWidth);

  //Scrolling
  /*window.scrollTo(s1coords.left + window.pageXOffset ,  s1coords.top + window.pageYOffset);
  window.scrollTo({
    left: s1coords.left + window.pageXOffset ,  
    top: s1coords.top + window.pageYOffset,
    behaviour:'smooth',}
 
  )*/
  section1.scrollIntoView({ behaviour: 'smooth' });

});


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
function googleTranslateElementInit() {
  new google.translate.TranslateElement(
    {
      pageLanguage: 'en',
      includedLanguages: 'hi,en',
      layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
      autoDisplay: false
    },
    'google_translate_element'
  );

  // Instantly trigger translation when Google Translate loads if Hindi is selected
  const savedLang = getActiveLanguage();
  if (savedLang === 'hi') {
    applyLanguageToCombo('hi');
  }
}

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
  const host = window.location.hostname;
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    document.cookie = name + "=" + (value || "") + expires + "; domain=." + host + "; path=/";
  }
}

function clearTransCookies() {
  const host = window.location.hostname;
  document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=" + host + "; path=/;";
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=." + host + "; path=/;";
  }
}

function applyLanguageToCombo(targetLang) {
  const combo = document.querySelector('.goog-te-combo');
  if (combo) {
    const val = targetLang === 'hi' ? 'hi' : '';
    if (combo.value !== val) {
      combo.value = val;
      combo.dispatchEvent(new Event('change'));
    }
    return true;
  }
  return false;
}

function switchLanguage(targetLang) {
  updateLangBtnText(targetLang);

  if (targetLang === 'hi') {
    localStorage.setItem('userLanguage', 'hi');
    setCookie('googtrans', '/en/hi', 30);
    
    if (!applyLanguageToCombo('hi')) {
      window.location.reload();
    }
  } else {
    localStorage.setItem('userLanguage', 'en');
    clearTransCookies();
    setCookie('googtrans', '/en/en', 30);

    if (!applyLanguageToCombo('en')) {
      window.location.reload();
    }
  }
}

function initLanguageState() {
  const currentLang = getActiveLanguage();
  updateLangBtnText(currentLang);

  if (currentLang === 'hi') {
    if (!document.cookie.includes('googtrans=/en/hi')) {
      setCookie('googtrans', '/en/hi', 30);
    }
  } else {
    if (document.cookie.includes('googtrans=/en/hi')) {
      clearTransCookies();
    }
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

    // Completely hide login and signup page/container after login
    if (headerFormContainer) headerFormContainer.classList.add('d-none');
    if (headerTitle) headerTitle.classList.add('header__title--logged-in');

    // Show Personal section, Personal nav link, and Logout button in navigation bar
    if (sectionPersonal) sectionPersonal.classList.remove('d-none');
    if (navItemPersonal) navItemPersonal.classList.remove('d-none');
    if (navItemLogout) navItemLogout.classList.remove('d-none');
  } else {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('username');

    // Show login/signup form container when logged out
    if (headerFormContainer) headerFormContainer.classList.remove('d-none');
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

// Attach Form Submit Handlers
if (formLogin) {
  formLogin.addEventListener('submit', function (e) {
    e.preventDefault();
    const uname = inputUsername && inputUsername.value.trim() ? inputUsername.value.trim() : 'User';
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('username', uname);
    
    // Redirect to personal details web page in the SAME TAB
    window.location.href = 'personal.html';
  });
}

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

