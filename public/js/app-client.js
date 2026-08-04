/* 7 STAR INVEST - Production Client Engine with Custom Toast & Modal Dialog System */

const API = '/api';
let AppState = {
  token: localStorage.getItem('star_token') || null,
  user: JSON.parse(localStorage.getItem('star_user') || 'null'),
  activePlans: [],
  config: null
};

document.addEventListener('DOMContentLoaded', async () => {
  // Native Mobile App Integration: Bypass landing page inside installed Capacitor app
  const isCapacitor = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) || navigator.userAgent.includes('Capacitor');
  if (isCapacitor) {
    const currentPath = window.location.pathname;
    if (currentPath === '/' || currentPath.endsWith('/index.html')) {
      const token = localStorage.getItem('star_token');
      window.location.href = token ? '/dashboard.html' : '/login.html';
      return;
    }
  }

  // Native Mobile Hardware Back Button Support
  document.addEventListener('backbutton', (e) => {
    e.preventDefault();
    const activeModal = document.querySelector('.custom-modal-overlay.active, #plan-modal-overlay.active, #receipt-modal-overlay.active');
    if (activeModal) {
      activeModal.classList.remove('active');
      return;
    }
    const drawerOverlay = document.getElementById('drawer-overlay');
    if (drawerOverlay && drawerOverlay.classList.contains('active')) {
      drawerOverlay.classList.remove('active');
      const drawerMenu = document.getElementById('drawer-menu');
      if (drawerMenu) drawerMenu.classList.remove('active');
      return;
    }
    const path = window.location.pathname;
    if (path.includes('/login.html') || path.includes('/dashboard.html') || path === '/') {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.exitApp();
      }
    } else {
      window.history.back();
    }
  });

  setupDrawer();
  injectToastContainer();
  injectModalContainer();
  
  updateClientUI(); // Render immediately from local state

  await loadConfig();
  if (AppState.token) {
    await fetchUserProfile();
  }
});

// Toast & Modal Helper Injection
function injectToastContainer() {
  if (!document.getElementById('custom-toast-container')) {
    const container = document.createElement('div');
    container.id = 'custom-toast-container';
    document.body.appendChild(container);
  }
}

function injectModalContainer() {
  if (!document.getElementById('custom-modal-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.className = 'custom-modal-overlay';
    overlay.innerHTML = `
      <div class="custom-modal-box">
        <div id="modal-icon" class="modal-icon-circle">⭐</div>
        <h3 id="modal-title" class="modal-title">Notice</h3>
        <p id="modal-text" class="modal-text">Message</p>
        <div id="modal-actions" class="modal-actions">
          <button id="modal-btn-confirm" class="btn-activate-gold" style="flex:1;">OK</button>
          <button id="modal-btn-cancel" class="btn-activate-gold" style="flex:1; background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); display:none;">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
}

// Helper for Button Loading State & Double Click Prevention
function setButtonLoading(btn, isLoading, loadingText = 'Processing...') {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = '0.75';
    btn.style.pointerEvents = 'none';
    btn.innerHTML = `<span class="spinner-icon">🔄</span> ${loadingText}`;
  } else {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }
}

// Show Toast Notification
function showToast(message, type = 'success') {
  injectToastContainer();
  const container = document.getElementById('custom-toast-container');
  const toast = document.createElement('div');
  toast.className = `custom-toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Show Modal Dialog
function showCustomModal(title, text, type = 'info', onConfirm = null) {
  injectModalContainer();
  const overlay = document.getElementById('custom-modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalText = document.getElementById('modal-text');
  const modalIcon = document.getElementById('modal-icon');
  const confirmBtn = document.getElementById('modal-btn-confirm');
  const cancelBtn = document.getElementById('modal-btn-cancel');

  modalTitle.textContent = title;
  modalText.textContent = text;
  modalIcon.textContent = type === 'success' ? '🌟' : type === 'error' ? '⚠️' : '⭐';

  if (onConfirm) {
    cancelBtn.style.display = 'block';
    cancelBtn.onclick = () => overlay.classList.remove('active');
    confirmBtn.onclick = () => {
      overlay.classList.remove('active');
      onConfirm();
    };
  } else {
    cancelBtn.style.display = 'none';
    confirmBtn.onclick = () => overlay.classList.remove('active');
  }

  overlay.classList.add('active');
}

// Load Public Config
async function loadConfig() {
  try {
    const res = await fetch(`${API}/config`);
    const data = await res.json();
    AppState.config = data;
    renderNotice(data.settings.notice_text);
    renderPlans(data.plans);
    renderGatewayDetails(data.settings);
  } catch (err) {
    console.error("Config load error:", err);
  }
}

// Fetch Profile & Update State
async function fetchUserProfile() {
  try {
    const res = await fetch(`${API}/user/profile`, {
      headers: { 'Authorization': `Bearer ${AppState.token}` }
    });
    const data = await res.json();
    if (data.success) {
      AppState.user = data.user;
      AppState.activePlans = data.activePlans;
      localStorage.setItem('star_user', JSON.stringify(data.user));
      updateClientUI();
    }
  } catch (err) {
    console.error("Profile sync error:", err);
  }
}

// Setup Slide Drawer
function setupDrawer() {
  const toggleBtn = document.getElementById('drawer-toggle-btn');
  const overlay = document.getElementById('drawer-overlay');
  const menu = document.getElementById('drawer-menu');
  const closeBtn = document.getElementById('drawer-close-btn');

  if (toggleBtn && overlay && menu) {
    toggleBtn.addEventListener('click', () => {
      overlay.classList.add('active');
      menu.classList.add('active');
    });
  }

  if (closeBtn && overlay && menu) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('active');
      menu.classList.remove('active');
    });
    overlay.addEventListener('click', () => {
      overlay.classList.remove('active');
      menu.classList.remove('active');
    });
  }
}

// Render Notice Marquee
function renderNotice(text) {
  const marquee = document.getElementById('app-notice-text');
  if (marquee && text) marquee.textContent = text;
}

// Render Plans Grid
function renderPlans(plans) {
  const container = document.getElementById('vip-plans-list') || document.getElementById('plans-container');
  if (!container || !plans) return;

  container.innerHTML = plans.map(p => {
    const planId = p._id || p.id;
    const validityDays = p.validity_days || p.validityDays || 40;
    const dailyProfit = p.daily_profit || p.dailyProfit || 0;
    const totalProfit = p.total_profit || p.totalProfit || 0;
    const level1Bonus = p.level1_bonus || p.level1Bonus || Math.round(dailyProfit * 0.05);
    const level2Bonus = p.level2_bonus || p.level2Bonus || Math.round(dailyProfit * 0.02);

    return `
    <div class="vip-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:28px; padding:1.25rem; margin-bottom:1.5rem; box-shadow:0 10px 30px rgba(15,23,42,0.05);">
      
      <!-- Top Card Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="width:48px; height:48px; border-radius:16px; background:#f4f8f6; border:1px solid #e2e8f0; color:var(--primary-teal); font-weight:800; font-size:1.2rem; display:flex; align-items:center; justify-content:center;">
            ⭐
          </div>
          <div>
            <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-dark); margin:0;">${p.name} 🛡️</h3>
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">🕒 ${validityDays} Days Validity</span>
          </div>
        </div>
        <span style="background:var(--teal-gold-gradient); color:#ffffff; padding:0.35rem 0.85rem; border-radius:20px; font-size:0.75rem; font-weight:800;">${p.name}</span>
      </div>

      <!-- Investment Box -->
      <div style="background:#f4f8f6; border:1px solid #e2e8f0; border-radius:18px; padding:1rem 1.25rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <div>
          <span style="font-size:0.7rem; font-weight:800; color:var(--primary-teal); letter-spacing:1px; text-transform:uppercase;">INVESTMENT</span>
          <div style="font-size:1.5rem; font-weight:800; color:var(--primary-teal);">PKR ${(p.price || 0).toLocaleString()}</div>
        </div>
        <div style="width:42px; height:42px; border-radius:50%; background:var(--teal-gold-gradient); color:#ffffff; font-size:1.2rem; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,92,83,0.2);">
          💰
        </div>
      </div>

      <!-- Daily & Total Profit Grid -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1rem;">
        <div style="background:#f4f8f6; border:1px solid #e2e8f0; border-radius:16px; padding:0.85rem 1rem;">
          <span style="font-size:0.7rem; font-weight:800; color:var(--emerald-green); display:flex; align-items:center; gap:0.3rem;">📈 DAILY</span>
          <div style="font-size:1.25rem; font-weight:800; color:var(--text-dark); margin-top:0.2rem;">${dailyProfit.toFixed(2)}</div>
        </div>
        <div style="background:#f4f8f6; border:1px solid #e2e8f0; border-radius:16px; padding:0.85rem 1rem;">
          <span style="font-size:0.7rem; font-weight:800; color:var(--cyan-neon); display:flex; align-items:center; gap:0.3rem;">👛 TOTAL</span>
          <div style="font-size:1.25rem; font-weight:800; color:var(--text-dark); margin-top:0.2rem;">${totalProfit.toFixed(2)}</div>
        </div>
      </div>

      <!-- 2-Tier Referral Commission Box -->
      <div style="background:#f4f8f6; border:1px solid #e2e8f0; border-radius:18px; padding:1rem; margin-bottom:1.25rem;">
        <span style="font-size:0.8rem; font-weight:800; color:var(--primary-teal); display:block; margin-bottom:0.75rem;">👥 Referral Commission · Daily Mining</span>
        
        <div style="background:#ffffff; border-radius:12px; padding:0.6rem 0.85rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; font-size:0.8rem; color:var(--text-muted); font-weight:600;">
          <span>Level 1</span>
          <div>
            <span style="color:var(--emerald-green); font-weight:800; margin-right:0.4rem;">5%</span>
            <strong style="color:var(--primary-gold);">PKR ${level1Bonus}</strong>
          </div>
        </div>

        <div style="background:#ffffff; border-radius:12px; padding:0.6rem 0.85rem; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted); font-weight:600;">
          <span>Level 2</span>
          <div>
            <span style="color:var(--cyan-neon); font-weight:800; margin-right:0.4rem;">2%</span>
            <strong style="color:var(--primary-gold);">PKR ${level2Bonus}</strong>
          </div>
        </div>
      </div>

      <!-- Activate Button -->
      <button onclick="activatePlan('${planId}', '${p.name}', ${p.price})" class="btn-activate-gold">
        👑 Activate Plan
      </button>

    </div>
  `}).join('');
}

function renderGatewayDetails(s) {
  const epName = document.getElementById('gateway-ep-name');
  const epNum = document.getElementById('gateway-ep-num');
  if (epName && s && s.easypaisa_title) epName.textContent = s.easypaisa_title;
  if (epNum && s && s.easypaisa_number) {
    epNum.textContent = s.easypaisa_number;
    const parentCopyBtn = epNum.nextElementSibling;
    if (parentCopyBtn) parentCopyBtn.setAttribute('onclick', `copyText('${s.easypaisa_number}')`);
  }
}

// Update UI
function updateClientUI() {
  const u = AppState.user;

  const usernameElems = document.querySelectorAll('.user-dyn-username');
  const balanceElems = document.querySelectorAll('.user-dyn-balance');
  const depositElems = document.querySelectorAll('.user-dyn-deposit');
  const withdrawElems = document.querySelectorAll('.user-dyn-withdraw');
  const profitElems = document.querySelectorAll('.user-dyn-profit');
  const refLinkElem = document.getElementById('user-dyn-reflink');
  const avatarInitials = document.querySelectorAll('.user-avatar-initials');

  if (u) {
    usernameElems.forEach(e => e.textContent = u.username);
    balanceElems.forEach(e => e.textContent = `PKR ${(u.balance || 0).toLocaleString()}`);
    depositElems.forEach(e => e.textContent = `PKR ${(u.total_deposit || 0).toLocaleString()}`);
    withdrawElems.forEach(e => e.textContent = `PKR ${(u.total_withdraw || 0).toLocaleString()}`);
    profitElems.forEach(e => e.textContent = `PKR ${(u.total_profit ?? u.totalProfit ?? 0).toLocaleString()}`);
    
    avatarInitials.forEach(e => {
      e.textContent = (u.username || '7S').slice(0, 2).toUpperCase();
    });

    if (refLinkElem) {
      refLinkElem.value = `${window.location.origin}/register.html?ref=${u.referral_code}`;
    }
  }
  renderMiningCards();
}

// Render Active Mining Cards
function renderMiningCards() {
  const container = document.getElementById('mining-cards-container');
  if (!container) return;

  if (!AppState.activePlans || AppState.activePlans.length === 0) {
    container.innerHTML = `
      <div style="width:64px; height:64px; border-radius:18px; background:rgba(217,119,6,0.15); color:var(--primary-gold); font-size:2rem; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;">
        📦
      </div>
      <div style="font-size:1.05rem; font-weight:800; color:var(--text-dark);">No active VIP plan found.</div>
      <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem; margin-bottom:1.5rem;">Purchase a VIP package to activate daily profit mining.</p>
      <a href="/plans.html" class="btn-activate-gold" style="text-decoration:none; display:inline-flex; width:auto; padding:0.75rem 1.5rem;">
        ⭐ View VIP Plans
      </a>
    `;
    return;
  }

  container.innerHTML = AppState.activePlans.map(plan => `
    <div class="vip-card" style="text-align:left; margin-bottom:1rem;">
      <div class="vip-card-header">
        <div>
          <h3 style="font-size:1.1rem; color:var(--text-dark);">${plan.plan_name} Mining Rig ⚡</h3>
          <span style="font-size:0.75rem; color:var(--emerald-green); font-weight:700;">🟢 Active Mining</span>
        </div>
        <span class="vip-badge-pill">ACTIVE</span>
      </div>
      <div class="vip-stats-grid">
        <div class="vip-stat-box">
          <span style="font-size:0.7rem; font-weight:800; color:var(--primary-gold);">INVESTED</span>
          <div style="font-size:1.1rem; font-weight:800; color:var(--text-dark);">PKR ${plan.investment.toLocaleString()}</div>
        </div>
        <div class="vip-stat-box">
          <span style="font-size:0.7rem; font-weight:800; color:var(--emerald-green);">DAILY RETURN</span>
          <div style="font-size:1.1rem; font-weight:800; color:var(--text-dark);">PKR ${plan.daily_profit.toLocaleString()}</div>
        </div>
      </div>
      <button onclick="claimDailyProfit(${plan.id})" class="btn-activate-gold" style="background:var(--emerald-gradient); color:#ffffff;">
        ⚡ Claim Daily Output (PKR ${plan.daily_profit})
      </button>
    </div>
  `).join('');
}

// Claim Daily Profit Action
async function claimDailyProfit(userPlanId) {
  if (!AppState.user) return showToast('Please login first', 'error');
  try {
    const res = await fetch(`${API}/claim-daily-profit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: AppState.user.id, userPlanId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await fetchUserProfile();
    } else {
      showCustomModal('Mining Output Compiling', data.message, 'info');
    }
  } catch (err) {
    showToast('Failed to claim profit', 'error');
  }
}


// User Register Form Handler
async function handleRegister(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const username = document.getElementById('reg-username').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;
  const ref = document.getElementById('reg-ref').value;

  setButtonLoading(submitBtn, true, 'Creating Account...');

  try {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, phone, password, ref })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('star_token', data.token);
      localStorage.setItem('star_user', JSON.stringify(data.user));
      AppState.token = data.token;
      AppState.user = data.user;
      
      showToast('Account registered successfully! Welcome to 7 STAR INVEST.', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1000);
    } else {
      setButtonLoading(submitBtn, false);
      showCustomModal('Registration Failed', data.message, 'error');
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showToast('Server connection error', 'error');
  }
}

// User Login Form Handler
async function handleLogin(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  setButtonLoading(submitBtn, true, 'Signing In...');

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('star_token', data.token);
      localStorage.setItem('star_user', JSON.stringify(data.user));
      AppState.token = data.token;
      AppState.user = data.user;

      showToast('Login successful! Opening dashboard...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1000);
    } else {
      setButtonLoading(submitBtn, false);
      showCustomModal('Login Failed', data.message, 'error');
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showToast('Login error. Please try again.', 'error');
  }
}

// Logout
function logout() {
  localStorage.removeItem('star_token');
  localStorage.removeItem('star_user');
  AppState.token = null;
  AppState.user = null;
  showToast('Logged out successfully', 'info');
  setTimeout(() => window.location.href = '/login.html', 500);
}

// Toggle Balance View
let balanceHidden = false;
function toggleBalanceView() {
  const elem = document.getElementById('balance-display-val');
  if (elem && AppState.user) {
    balanceHidden = !balanceHidden;
    if (balanceHidden) {
      elem.textContent = 'PKR ••••••';
    } else {
      elem.textContent = `PKR ${(AppState.user.balance || 0).toLocaleString()}`;
    }
  }
}

// Deposit Form Handler
async function handleDepositSubmit(e) {
  e.preventDefault();
  if (!AppState.user) return showToast('Please login first', 'error');

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const amount = document.getElementById('dep-amount').value;
  const gateway = document.getElementById('dep-gateway').value;
  const tid = document.getElementById('dep-tid').value;
  const fileInput = document.getElementById('dep-screenshot-file');

  setButtonLoading(submitBtn, true, 'Submitting Deposit...');

  let screenshotData = null;
  if (fileInput && fileInput.files[0]) {
    const file = fileInput.files[0];
    screenshotData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  try {
    const res = await fetch(`${API}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: AppState.user.id,
        amount,
        gateway,
        tid,
        screenshotData
      })
    });
    const data = await res.json();
    if (data.success) {
      showCustomModal('Deposit Request Submitted', data.message, 'success', () => {
        window.location.href = '/dashboard.html';
      });
    } else {
      setButtonLoading(submitBtn, false);
      showCustomModal('Deposit Failed', data.message, 'error');
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showToast('Failed to submit deposit.', 'error');
  }
}

// Withdraw Form Handler
async function handleWithdrawSubmit(e) {
  e.preventDefault();
  if (!AppState.user) return showToast('Please login first', 'error');

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const amount = document.getElementById('wit-amount').value;
  const gateway = document.getElementById('wit-gateway').value;
  const accountTitle = document.getElementById('wit-title').value;
  const accountNumber = document.getElementById('wit-number').value;
  const bankName = document.getElementById('wit-bank-name') ? document.getElementById('wit-bank-name').value : null;

  setButtonLoading(submitBtn, true, 'Submitting Withdrawal...');

  try {
    const res = await fetch(`${API}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: AppState.user.id,
        amount,
        gateway,
        accountTitle,
        accountNumber,
        bankName
      })
    });
    const data = await res.json();
    if (data.success) {
      showCustomModal('Withdrawal Submitted', data.message, 'success', async () => {
        await fetchUserProfile();
        window.location.href = '/dashboard.html';
      });
    } else {
      setButtonLoading(submitBtn, false);
      showCustomModal('Withdrawal Failed', data.message, 'error');
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showToast('Failed to submit withdrawal.', 'error');
  }
}

// Activate Plan Action with Modal Confirmation
function activatePlan(planId, planName, planPrice) {
  if (!AppState.user) return showToast('Please login first', 'error');

  showCustomModal(
    `Confirm Subscription`,
    `Are you sure you want to activate ${planName} for PKR ${planPrice.toLocaleString()} using your wallet balance?`,
    'info',
    async () => {
      try {
        const res = await fetch(`${API}/activate-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: AppState.user.id, planId })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          await fetchUserProfile();
          setTimeout(() => window.location.href = '/dashboard.html', 1000);
        } else {
          showCustomModal('Subscription Error', data.message, 'error');
        }
      } catch (err) {
        showToast('Activation error.', 'error');
      }
    }
  );
}

// Copy Referral Link
function copyReferralLink() {
  const refElem = document.getElementById('user-dyn-reflink');
  if (refElem) {
    refElem.select();
    document.execCommand('copy');
    showToast('Referral link copied to clipboard!', 'success');
  }
}

// Copy text helper
function copyText(str) {
  navigator.clipboard.writeText(str);
  showToast(`Copied: ${str}`, 'info');
}
