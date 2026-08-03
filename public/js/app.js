/* 7 STAR INVEST - Core Frontend Engine & Client Handler */

const API_BASE = '/api';

// State Container
const AppState = {
  config: null,
  user: null,
  deposits: [],
  withdrawals: []
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  loadLocalUser();
  await fetchConfig();
  updateUI();
  setupPWAInstall();
});

// Load User from Local Storage
function loadLocalUser() {
  const saved = localStorage.getItem('7star_user');
  if (saved) {
    try {
      AppState.user = JSON.parse(saved);
    } catch (e) {
      console.error("Error loading user:", e);
    }
  }
}

// Save User to Local Storage
function saveLocalUser(user) {
  AppState.user = user;
  if (user) {
    localStorage.setItem('7star_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('7star_user');
  }
}

// Fetch Public Config & Plans
async function fetchConfig() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    const data = await res.json();
    AppState.config = data;
    renderNotice(data.settings.noticeText);
    renderPlans(data.plans);
    renderGateways(data.settings);
  } catch (err) {
    console.error("Failed to fetch config, using fallback:", err);
  }
}

// Render Live Notice Marquee
function renderNotice(text) {
  const elem = document.getElementById('notice-marquee-text');
  if (elem && text) {
    elem.textContent = text;
  }
}

// Render Plans Grid
function renderPlans(plans) {
  const container = document.getElementById('plans-container');
  if (!container || !plans) return;

  container.innerHTML = plans.map(plan => `
    <div class="plan-card">
      <span class="plan-badge">${plan.name}</span>
      <div class="plan-price">PKR ${plan.price.toLocaleString()}</div>
      <ul class="plan-stats">
        <li><span>Daily Profit:</span> <strong>PKR ${plan.dailyProfit}</strong></li>
        <li><span>Duration:</span> <strong>${plan.durationDays} Days</strong></li>
        <li><span>Level 1 Bonus (5%):</span> <strong>PKR ${plan.level1Bonus}</strong></li>
        <li><span>Level 2 Bonus (2%):</span> <strong>PKR ${plan.level2Bonus}</strong></li>
      </ul>
      <button class="btn btn-gold btn-full" onclick="subscribePlan(${plan.id})">
        Register & Invest
      </button>
    </div>
  `).join('');
}

// Render Payment Gateways on Deposit Page
function renderGateways(settings) {
  const epTitle = document.getElementById('ep-title');
  const epNum = document.getElementById('ep-num');
  const jcTitle = document.getElementById('jc-title');
  const jcNum = document.getElementById('jc-num');

  if (epTitle && settings) epTitle.textContent = settings.easypaisaTitle;
  if (epNum && settings) epNum.textContent = settings.easypaisaNumber;
  if (jcTitle && settings) jcTitle.textContent = settings.jazzcashTitle;
  if (jcNum && settings) jcNum.textContent = settings.jazzcashNumber;
}

// Update Dashboard UI Elements
function updateUI() {
  const user = AppState.user;

  // Nav Login/Register / Logout state
  const authNav = document.getElementById('auth-nav');
  if (authNav) {
    if (user) {
      authNav.innerHTML = `
        <a href="/dashboard.html" class="nav-link">Dashboard</a>
        <a href="/admin/index.html" class="nav-link admin-link" style="color:var(--primary-gold); font-weight:bold;">Admin Panel</a>
        <button onclick="logoutUser()" class="btn btn-outline btn-sm">Logout</button>
      `;
    } else {
      authNav.innerHTML = `
        <a href="/login.html" class="btn btn-outline btn-sm">Login</a>
        <a href="/register.html" class="btn btn-gold btn-sm">Register</a>
      `;
    }
  }

  // Dashboard Specific Updates
  if (user) {
    const userNameElem = document.getElementById('dash-user-name');
    const userPhoneElem = document.getElementById('dash-user-phone');
    const balanceElem = document.getElementById('dash-balance');
    const depositElem = document.getElementById('dash-deposit');
    const withdrawElem = document.getElementById('dash-withdraw');
    const profitElem = document.getElementById('dash-profit');
    const refCodeElem = document.getElementById('dash-ref-code');
    const refLinkElem = document.getElementById('dash-ref-link');

    if (userNameElem) userNameElem.textContent = user.name;
    if (userPhoneElem) userPhoneElem.textContent = user.phone;
    if (balanceElem) balanceElem.textContent = `PKR ${user.balance.toLocaleString()}`;
    if (depositElem) depositElem.textContent = `PKR ${(user.totalDeposit || 0).toLocaleString()}`;
    if (withdrawElem) withdrawElem.textContent = `PKR ${(user.totalWithdraw || 0).toLocaleString()}`;
    if (profitElem) profitElem.textContent = `PKR ${(user.totalProfit || 0).toLocaleString()}`;
    if (refCodeElem) refCodeElem.textContent = user.referralCode;
    if (refLinkElem) refLinkElem.value = `${window.location.origin}/register.html?ref=${user.referralCode}`;
  }
}

// Register Form Handler
async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;
  const referralCode = document.getElementById('reg-ref').value;

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password, referralCode })
    });
    const data = await res.json();
    if (data.success) {
      saveLocalUser(data.user);
      alert('Account registered successfully! Welcome to 7 STAR INVEST.');
      window.location.href = '/dashboard.html';
    } else {
      alert(data.message || 'Registration failed');
    }
  } catch (err) {
    alert('Server connection error. Please try again.');
  }
}

// Login Form Handler
async function handleLogin(event) {
  event.preventDefault();
  const phone = document.getElementById('login-phone').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();
    if (data.success) {
      saveLocalUser(data.user);
      alert('Login successful!');
      window.location.href = '/dashboard.html';
    } else {
      alert(data.message || 'Invalid credentials');
    }
  } catch (err) {
    alert('Server connection error.');
  }
}

// Logout
function logoutUser() {
  saveLocalUser(null);
  alert('You have logged out.');
  window.location.href = '/index.html';
}

// Deposit Form Handler
async function handleDeposit(event) {
  event.preventDefault();
  if (!AppState.user) {
    alert('Please log in first.');
    window.location.href = '/login.html';
    return;
  }

  const amount = document.getElementById('dep-amount').value;
  const gateway = document.getElementById('dep-gateway').value;
  const tid = document.getElementById('dep-tid').value;

  try {
    const res = await fetch(`${API_BASE}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: AppState.user.id,
        amount,
        gateway,
        tid
      })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      window.location.href = '/dashboard.html';
    } else {
      alert(data.message || 'Deposit failed');
    }
  } catch (err) {
    alert('Failed to submit deposit.');
  }
}

// Withdraw Form Handler
async function handleWithdraw(event) {
  event.preventDefault();
  if (!AppState.user) {
    alert('Please log in first.');
    return;
  }

  const amount = document.getElementById('wit-amount').value;
  const gateway = document.getElementById('wit-gateway').value;
  const accountTitle = document.getElementById('wit-title').value;
  const accountNumber = document.getElementById('wit-number').value;

  try {
    const res = await fetch(`${API_BASE}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: AppState.user.id,
        amount,
        gateway,
        accountTitle,
        accountNumber
      })
    });
    const data = await res.json();
    if (data.success) {
      saveLocalUser(data.user);
      alert(data.message);
      window.location.href = '/dashboard.html';
    } else {
      alert(data.message || 'Withdrawal failed');
    }
  } catch (err) {
    alert('Error submitting withdrawal.');
  }
}

// Subscribe Plan Handler
async function subscribePlan(planId) {
  if (!AppState.user) {
    alert('Please register or log in to invest in a VIP plan.');
    window.location.href = '/login.html';
    return;
  }

  if (confirm('Are you sure you want to purchase this VIP plan with your wallet balance?')) {
    try {
      const res = await fetch(`${API_BASE}/buy-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: AppState.user.id,
          planId
        })
      });
      const data = await res.json();
      if (data.success) {
        saveLocalUser(data.user);
        alert(data.message);
        window.location.href = '/dashboard.html';
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Subscription error.');
    }
  }
}

// Copy Referral Link helper
function copyRefLink() {
  const linkElem = document.getElementById('dash-ref-link');
  if (linkElem) {
    linkElem.select();
    document.execCommand('copy');
    alert('Referral link copied to clipboard!');
  }
}

// Copy Account Number helper
function copyText(text) {
  navigator.clipboard.writeText(text);
  alert(`Copied: ${text}`);
}

// Setup PWA Prompt
let deferredPrompt;
function setupPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'inline-flex';
  });
}

function triggerPWAInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted PWA installation');
      }
      deferredPrompt = null;
    });
  } else {
    alert('To install 7 Star App on your Mobile phone:\n\n1. Open browser menu (3 dots or share button)\n2. Tap "Add to Home screen" or "Install App".');
  }
}
