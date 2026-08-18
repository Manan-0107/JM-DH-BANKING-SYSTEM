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

// Language Switcher (Bilingual English / Hindi)
const langToggleBtn = document.getElementById('lang-toggle');
let currentLang = 'en';

const translations = {
  en: {
    heroTitle: 'When <span class="highlight">banking</span> meets<br /><span class="highlight">minimalist</span>',
    heroSub: 'A simpler banking experience for a simpler life.',
    heroLearn: 'Learn more ↓',
    tabLogin: 'Log In',
    tabSignup: 'Sign Up',
    loginHeader: 'Welcome Back',
    signupHeader: 'Get Started Today',
    lblUser: 'User ID / Email',
    lblPass: 'PIN / Password',
    lblFullname: 'Full Name',
    lblEmail: 'Email Address',
    lblCreatepass: 'Create PIN',
    btnLogin: 'LOG IN →',
    btnSignup: 'CREATE ACCOUNT →'
  },
  hi: {
    heroTitle: 'जब <span class="highlight">बैंकिंग</span> मिले<br /><span class="highlight">सरलता</span> से',
    heroSub: 'सरल जीवन के लिए एक सरल एवं आधुनिक बैंकिंग अनुभव।',
    heroLearn: 'और जानें ↓',
    tabLogin: 'लॉग इन',
    tabSignup: 'साइन अप',
    loginHeader: 'पुनः स्वागत है',
    signupHeader: 'आज ही शुरुआत करें',
    lblUser: 'उपयोगकर्ता आईडी / ईमेल',
    lblPass: 'पिन / पासवर्ड',
    lblFullname: 'पूरा नाम',
    lblEmail: 'ईमेल पता',
    lblCreatepass: 'पिन बनाएं',
    btnLogin: 'लॉग इन करें →',
    btnSignup: 'खाता बनाएं →'
  }
};

if (langToggleBtn) {
  langToggleBtn.addEventListener('click', function () {
    currentLang = currentLang === 'en' ? 'hi' : 'en';
    const t = translations[currentLang];

    langToggleBtn.textContent = currentLang === 'en' ? '🌐 EN / हिंदी' : '🌐 हिंदी / EN';

    const heroHeading = document.getElementById('hero-heading');
    const heroSubheading = document.getElementById('hero-subheading');
    const heroLearnMore = document.getElementById('hero-learn-more');
    const tabLoginBtn = document.getElementById('tab-login-btn');
    const tabSignupBtn = document.getElementById('tab-signup-btn');
    const loginHeaderTitle = document.getElementById('login-header-title');
    const signupHeaderTitle = document.getElementById('signup-header-title');
    const lblUser = document.getElementById('lbl-user');
    const lblPass = document.getElementById('lbl-pass');
    const lblFullname = document.getElementById('lbl-fullname');
    const lblEmail = document.getElementById('lbl-email');
    const lblCreatepass = document.getElementById('lbl-createpass');
    const btnLoginSubmit = document.getElementById('btn-login-submit');
    const btnSignupSubmit = document.getElementById('btn-signup-submit');

    if (heroHeading) heroHeading.innerHTML = t.heroTitle;
    if (heroSubheading) heroSubheading.textContent = t.heroSub;
    if (heroLearnMore) heroLearnMore.textContent = t.heroLearn;

    if (tabLoginBtn) tabLoginBtn.textContent = t.tabLogin;
    if (tabSignupBtn) tabSignupBtn.textContent = t.tabSignup;

    if (loginHeaderTitle) loginHeaderTitle.textContent = t.loginHeader;
    if (signupHeaderTitle) signupHeaderTitle.textContent = t.signupHeader;

    if (lblUser) lblUser.textContent = t.lblUser;
    if (lblPass) lblPass.textContent = t.lblPass;
    if (lblFullname) lblFullname.textContent = t.lblFullname;
    if (lblEmail) lblEmail.textContent = t.lblEmail;
    if (lblCreatepass) lblCreatepass.textContent = t.lblCreatepass;

    if (btnLoginSubmit) btnLoginSubmit.textContent = t.btnLogin;
    if (btnSignupSubmit) btnSignupSubmit.textContent = t.btnSignup;

    document.querySelectorAll('.nav__link').forEach(link => {
      const text = link.dataset[currentLang];
      if (text) link.textContent = text;
    });
  });
}

// ============================================================
// LOGIN / AUTHENTICATION & PERSONAL SECTION VISIBILITY
// ============================================================
const sectionPersonal = document.getElementById('section--2');
const navItemPersonal = document.getElementById('nav-item-personal');
const userProfileCard = document.getElementById('user-profile-card');
const welcomeUserText = document.getElementById('welcome-user-text');
const btnLogout = document.getElementById('btn-logout');
const btnViewPersonal = document.getElementById('btn-view-personal');
const inputUsername = document.getElementById('input-username');
const inputFullname = document.getElementById('input-fullname');

function updateAuthState(isLoggedIn, username = 'User') {
  if (isLoggedIn) {
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('username', username);

    // Hide forms & tab selector
    if (formLogin) formLogin.classList.add('hidden');
    if (formSignup) formSignup.classList.add('hidden');
    if (tabContainer) tabContainer.classList.add('d-none');

    // Show profile card
    if (userProfileCard) userProfileCard.classList.remove('d-none');
    if (welcomeUserText) welcomeUserText.textContent = `Welcome, ${username}!`;

    // Show Personal section & Nav item
    if (sectionPersonal) sectionPersonal.classList.remove('d-none');
    if (navItemPersonal) navItemPersonal.classList.remove('d-none');
  } else {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('username');

    // Hide profile card & show tab selector
    if (userProfileCard) userProfileCard.classList.add('d-none');
    if (tabContainer) tabContainer.classList.remove('d-none');

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

    // Hide Personal section & Nav item
    if (sectionPersonal) sectionPersonal.classList.add('d-none');
    if (navItemPersonal) navItemPersonal.classList.add('d-none');
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

if (btnLogout) {
  btnLogout.addEventListener('click', function () {
    updateAuthState(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

if (btnViewPersonal) {
  btnViewPersonal.addEventListener('click', function () {
    window.location.href = 'personal.html';
  });
}

// Initial Session Check
document.addEventListener('DOMContentLoaded', function () {
  const savedLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  const savedUser = sessionStorage.getItem('username') || 'User';
  updateAuthState(savedLoggedIn, savedUser);
});
