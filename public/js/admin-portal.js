/* 7 STAR INVEST - Admin Portal Controller (Optimized & Paginated) */

const API = '/api/admin';
let AdminToken = localStorage.getItem('star_admin_token') || null;
let AdminState = {
  users: [],
  deposits: [],
  withdrawals: [],
  plans: [],
  activeUserPlans: [],
  settings: {}
};

// State for Admin Pagination & Search Filters
let PageState = {
  deposits: { page: 1, pageSize: 10, search: '' },
  withdrawals: { page: 1, pageSize: 10, search: '' },
  plans: { page: 1, pageSize: 10, search: '' },
  userPlans: { page: 1, pageSize: 10, search: '' },
  users: { page: 1, pageSize: 10, search: '' }
};

// Injected Custom Admin Modal & Prompt Container
function injectAdminModalContainer() {
  if (!document.getElementById('admin-custom-modal-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'admin-custom-modal-overlay';
    overlay.className = 'custom-modal-overlay';
    overlay.innerHTML = `
      <div class="custom-modal-box">
        <div id="adm-modal-icon" class="modal-icon-circle">⭐</div>
        <h3 id="adm-modal-title" class="modal-title">Admin Notice</h3>
        <p id="adm-modal-text" class="modal-text">Message</p>
        <div id="adm-modal-input-box" style="display:none; margin: 1rem 0;">
          <input type="text" id="adm-modal-input" class="auth-input-field" style="width:100%; font-weight:700; padding-left:1rem;" />
        </div>
        <div class="modal-actions" style="display:flex; gap:0.5rem; margin-top:1.25rem;">
          <button id="adm-modal-btn-cancel" class="btn-activate-gold" style="flex:1; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-weight:800; border-radius:16px; display:none;">Cancel</button>
          <button id="adm-modal-btn-confirm" class="btn-activate-gold" style="flex:1;">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
}

function showAdminModal(title, text, type = 'info', onConfirm = null) {
  injectAdminModalContainer();
  const overlay = document.getElementById('admin-custom-modal-overlay');
  const modalTitle = document.getElementById('adm-modal-title');
  const modalText = document.getElementById('adm-modal-text');
  const modalIcon = document.getElementById('adm-modal-icon');
  const inputBox = document.getElementById('adm-modal-input-box');
  const confirmBtn = document.getElementById('adm-modal-btn-confirm');
  const cancelBtn = document.getElementById('adm-modal-btn-cancel');

  modalTitle.textContent = title;
  modalText.textContent = text;
  inputBox.style.display = 'none';
  modalIcon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '⭐';

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

function showAdminPrompt(title, text, defaultValue = '', onConfirm) {
  injectAdminModalContainer();
  const overlay = document.getElementById('admin-custom-modal-overlay');
  const modalTitle = document.getElementById('adm-modal-title');
  const modalText = document.getElementById('adm-modal-text');
  const modalIcon = document.getElementById('adm-modal-icon');
  const inputBox = document.getElementById('adm-modal-input-box');
  const inputElem = document.getElementById('adm-modal-input');
  const confirmBtn = document.getElementById('adm-modal-btn-confirm');
  const cancelBtn = document.getElementById('adm-modal-btn-cancel');

  modalTitle.textContent = title;
  modalText.textContent = text;
  modalIcon.textContent = '✏️';
  inputBox.style.display = 'block';
  inputElem.value = defaultValue;

  cancelBtn.style.display = 'block';
  cancelBtn.onclick = () => overlay.classList.remove('active');
  confirmBtn.onclick = () => {
    const val = inputElem.value;
    overlay.classList.remove('active');
    if (onConfirm) onConfirm(val);
  };

  overlay.classList.add('active');
  setTimeout(() => inputElem.focus(), 100);
}

function setAdminButtonLoading(btn, isLoading, loadingText = 'Processing...') {
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

let adminPollInterval = null;

// Audio Chime & Push Notification System
function playAdminNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    console.error("Audio notification error:", e);
  }
}

function requestAdminNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function triggerSystemPushNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/images/logo.png',
        tag: 'admin-request-alert'
      });
    } catch (e) {}
  }
}

function initCapacitorAdminFCM() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) {
    try {
      const PushNotifications = window.Capacitor.Plugins.PushNotifications;
      
      // Create High-Priority Notification Channel for Lock Screen & Sound Alerts
      if (PushNotifications.createChannel) {
        PushNotifications.createChannel({
          id: 'default_channel_id',
          name: '7 STAR ADMIN Alerts',
          description: 'High-priority deposit and withdrawal requests',
          importance: 5, // HIGH
          visibility: 1, // PUBLIC (Lock Screen)
          sound: 'default',
          vibration: true
        }).catch(err => console.error('Channel creation error:', err));
      }

      PushNotifications.requestPermissions().then(result => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });

      PushNotifications.addListener('registration', (token) => {
        console.log('Admin FCM Token registered:', token.value);
        if (token && token.value) {
          fetch('/api/admin/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.value })
          }).catch(err => console.error('Error saving admin token:', err));
        }
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        playAdminNotificationSound();
        showAdminModal(notification.title || '🔔 New Admin Alert', notification.body || '', 'info');
        if (typeof switchAdminTab === 'function') {
          switchAdminTab('ledger');
        }
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        if (typeof switchAdminTab === 'function') {
          switchAdminTab('ledger');
        }
      });
    } catch(e) {
      console.error('FCM init error:', e);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Native Admin Mobile App Integration (Auto Redirect inside installed Admin App)
  const isCapacitor = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) || navigator.userAgent.includes('Capacitor');
  if (isCapacitor) {
    const currentPath = window.location.pathname;
    const token = localStorage.getItem('star_admin_token');
    if (token) {
      if (currentPath === '/' || currentPath.endsWith('/index.html') || currentPath.endsWith('/login.html')) {
        window.location.href = '/xpro-admin/dashboard.html';
        return;
      }
    } else {
      if (currentPath === '/' || currentPath.endsWith('/index.html')) {
        window.location.href = '/xpro-admin/login.html';
        return;
      }
    }
  }

  requestAdminNotificationPermission();
  initCapacitorAdminFCM();

  const isLoginPage = window.location.pathname.includes('/xpro-admin/login.html');
  
  if (!isLoginPage && !AdminToken) {
    window.location.href = '/xpro-admin/login.html';
    return;
  }

  if (!isLoginPage && AdminToken) {
    await fetchAdminData();
    
    // Real-Time 4-Second Auto Polling for Admin Panel
    if (adminPollInterval) clearInterval(adminPollInterval);
    adminPollInterval = setInterval(() => {
      if (!document.hidden && AdminToken) {
        fetchAdminData(true);
      }
    }, 4000);
  }
});

// Sync admin data immediately when window comes into focus
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && AdminToken) {
    fetchAdminData(true);
  }
});
window.addEventListener('focus', () => {
  if (AdminToken) {
    fetchAdminData(true);
  }
});

// Admin Login Handler
async function handleAdminLogin(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const username = document.getElementById('adm-username').value;
  const password = document.getElementById('adm-password').value;

  setAdminButtonLoading(submitBtn, true, 'Authenticating Admin...');

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('star_admin_token', data.token);
      AdminToken = data.token;
      showAdminModal('Authentication Success', 'Admin authenticated successfully!', 'success', () => {
        window.location.href = '/xpro-admin/dashboard.html';
      });
    } else {
      setAdminButtonLoading(submitBtn, false);
      showAdminModal('Login Failed', data.message, 'error');
    }
  } catch (err) {
    setAdminButtonLoading(submitBtn, false);
    showAdminModal('Error', 'Login error. Please check backend server.', 'error');
  }
}

// Admin Logout
function adminLogout() {
  localStorage.removeItem('star_admin_token');
  window.location.href = '/xpro-admin/login.html';
}

// Fetch Complete Admin Real-Time Data from Backend
async function fetchAdminData(silent = false) {
  try {
    const res = await fetch(`${API}/data`, {
      headers: { 'Authorization': `Bearer ${AdminToken}` }
    });
    const data = await res.json();
    if (res.status === 401 || (data && data.success === false)) {
      localStorage.removeItem('star_admin_token');
      window.location.href = '/xpro-admin/login.html';
      return;
    }
    AdminState = {
      users: data.users || [],
      deposits: data.deposits || [],
      withdrawals: data.withdrawals || [],
      plans: data.plans || [],
      activeUserPlans: data.activeUserPlans || [],
      settings: data.settings || {}
    };

    checkNewAdminNotifications(AdminState.deposits, AdminState.withdrawals);

    renderOverviewStats();
    renderDepositsTable();
    renderWithdrawalsTable();
    renderPlansTable();
    renderUserPlansTable();
    
    const activeElem = document.activeElement;
    const isFormFocused = activeElem && activeElem.closest('#view-settings');
    if (!isFormFocused) {
      renderSettingsForm();
    }

    const isUserSearchFocused = activeElem && activeElem.id === 'adm-user-search';
    if (!isUserSearchFocused) {
      renderUsersTable();
    }
  } catch (err) {
    if (!silent) console.error("Failed to load admin data:", err);
  }
}

// Notification Check Engine
let isFirstAdminFetch = true;
let knownPendingDepositIds = new Set();
let knownPendingWithdrawalIds = new Set();

function checkNewAdminNotifications(deposits, withdrawals) {
  const currentPendingDeps = (deposits || []).filter(d => d.status === 'Pending');
  const currentPendingWits = (withdrawals || []).filter(w => w.status === 'Pending');

  // Update navbar badge count
  const badgeElem = document.getElementById('adm-nav-notif-badge');
  const totalPending = currentPendingDeps.length + currentPendingWits.length;
  if (badgeElem) {
    badgeElem.textContent = totalPending;
    badgeElem.style.display = totalPending > 0 ? 'inline-block' : 'none';
  }

  if (isFirstAdminFetch) {
    currentPendingDeps.forEach(d => knownPendingDepositIds.add(String(d._id || d.id)));
    currentPendingWits.forEach(w => knownPendingWithdrawalIds.add(String(w._id || w.id)));
    isFirstAdminFetch = false;
    return;
  }

  // Check for new deposit requests
  currentPendingDeps.forEach(d => {
    const idStr = String(d._id || d.id);
    if (!knownPendingDepositIds.has(idStr)) {
      knownPendingDepositIds.add(idStr);

      const msg = `New Deposit Request: PKR ${Number(d.amount).toLocaleString()} from ${d.username} (${d.gateway})`;
      playAdminNotificationSound();
      triggerSystemPushNotification('🔔 New Deposit Request!', msg);
      showAdminModal('🔔 New Deposit Request!', msg, 'info');
    }
  });

  // Check for new withdrawal requests
  currentPendingWits.forEach(w => {
    const idStr = String(w._id || w.id);
    if (!knownPendingWithdrawalIds.has(idStr)) {
      knownPendingWithdrawalIds.add(idStr);

      const msg = `New Payout Request: PKR ${Number(w.amount).toLocaleString()} from ${w.username} (${w.gateway})`;
      playAdminNotificationSound();
      triggerSystemPushNotification('💸 New Withdrawal Request!', msg);
      showAdminModal('💸 New Withdrawal Request!', msg, 'info');
    }
  });
}

// Tab Switcher
function switchTab(tabName) {
  const tabs = ['deposits', 'withdrawals', 'plans', 'user-plans', 'settings', 'users'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const view = document.getElementById(`view-${t}`);
    if (btn) btn.classList.remove('active');
    if (view) view.style.display = 'none';
  });

  const activeBtn = document.getElementById(`tab-${tabName}`);
  const activeView = document.getElementById(`view-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activeView) activeView.style.display = 'block';
}

// Render Overview Statistics
function renderOverviewStats() {
  const uElem = document.getElementById('adm-stat-users');
  const dElem = document.getElementById('adm-stat-deposits');
  const wElem = document.getElementById('adm-stat-withdrawals');
  const pDep = document.getElementById('adm-stat-pending-dep');
  const pWit = document.getElementById('adm-stat-pending-wit');

  if (uElem) uElem.textContent = AdminState.users.length;
  
  const approvedDepSum = AdminState.deposits.filter(d => d.status === 'Approved').reduce((acc, d) => acc + d.amount, 0);
  if (dElem) dElem.textContent = `PKR ${approvedDepSum.toLocaleString()}`;

  const approvedWitSum = AdminState.withdrawals.filter(w => w.status === 'Approved').reduce((acc, w) => acc + w.amount, 0);
  if (wElem) wElem.textContent = `PKR ${approvedWitSum.toLocaleString()}`;

  const pendingDepCount = AdminState.deposits.filter(d => d.status === 'Pending').length;
  const pendingWitCount = AdminState.withdrawals.filter(w => w.status === 'Pending').length;

  if (pDep) pDep.textContent = pendingDepCount;
  if (pWit) pWit.textContent = pendingWitCount;
}

// Generic Pagination Bar Renderer
function renderPaginationBar(containerId, totalCount, currentPage, pageSize, setPageFnName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (totalCount === 0) {
    container.innerHTML = '';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(totalCount, currentPage * pageSize);

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 1rem; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8rem;">
      <span style="color: var(--text-muted); font-weight: 700;">
        Showing <strong>${startRecord}-${endRecord}</strong> of <strong>${totalCount}</strong> entries
      </span>
      <div style="display: flex; gap: 0.4rem; align-items: center;">
        <button onclick="${setPageFnName}(${currentPage - 1})" ${currentPage <= 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding: 0.35rem 0.75rem; border-radius: 8px; border: 1px solid #cbd5e1; background: #ffffff; color: var(--text-dark); font-weight: 700; cursor: pointer;">◀ Prev</button>
        <span style="font-weight: 800; color: var(--primary-gold); padding: 0 0.3rem;">Page ${currentPage} of ${totalPages}</span>
        <button onclick="${setPageFnName}(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding: 0.35rem 0.75rem; border-radius: 8px; border: 1px solid #fde68a; background: var(--gold-gradient); color: #ffffff; font-weight: 800; cursor: pointer;">Next ▶</button>
      </div>
    </div>
  `;
}

// Search Inputs Handlers
function onDepositSearchInput(e) {
  PageState.deposits.search = e.target.value;
  PageState.deposits.page = 1;
  renderDepositsTable();
}

function onWithdrawalSearchInput(e) {
  PageState.withdrawals.search = e.target.value;
  PageState.withdrawals.page = 1;
  renderWithdrawalsTable();
}

function onUserSearchInput(e) {
  PageState.users.search = e.target.value;
  PageState.users.page = 1;
  renderUsersTable();
}

// Deposits Table Renderer with Pagination & Filter
function setDepositsPage(newPage) {
  const filtered = getFilteredDeposits();
  const maxPage = Math.max(1, Math.ceil(filtered.length / PageState.deposits.pageSize));
  if (newPage >= 1 && newPage <= maxPage) {
    PageState.deposits.page = newPage;
    renderDepositsTable();
  }
}

function getFilteredDeposits() {
  const s = (PageState.deposits.search || '').toLowerCase().trim();
  if (!s) return AdminState.deposits;
  return AdminState.deposits.filter(d => 
    (d.deposit_ref || '').toLowerCase().includes(s) ||
    (d.username || '').toLowerCase().includes(s) ||
    (d.phone || '').toLowerCase().includes(s) ||
    (d.tid || '').toLowerCase().includes(s) ||
    (d.gateway || '').toLowerCase().includes(s)
  );
}

function renderDepositsTable() {
  const tbody = document.getElementById('adm-table-deposits');
  if (!tbody) return;

  const filtered = getFilteredDeposits();
  const pageSize = PageState.deposits.pageSize;
  const page = PageState.deposits.page;
  const start = (page - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  renderPaginationBar('adm-pagination-deposits', filtered.length, page, pageSize, 'setDepositsPage');

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No deposit records found.</td></tr>';
    return;
  }

  const html = pageData.map(d => `
    <tr>
      <td><strong>${d.deposit_ref}</strong></td>
      <td>${d.username}<br><small style="color:#64748b;">${d.phone}</small></td>
      <td><strong style="color:#059669;">PKR ${d.amount.toLocaleString()}</strong></td>
      <td><span style="color:#d97706; font-weight:700;">${d.gateway}</span></td>
      <td><code>${d.tid}</code></td>
      <td>
        ${d.screenshot ? `<button onclick="viewReceiptModal('${d.screenshot}')" class="admin-nav-btn" style="background:#fffbeb; color:#d97706; padding:0.3rem 0.6rem; font-size:0.75rem; border:1px solid #fde68a; cursor:pointer;">📷 View Receipt</button>` : '<span style="color:#94a3b8; font-size:0.75rem;">No Image</span>'}
      </td>
      <td><span class="status-badge status-${d.status}">${d.status}</span></td>
      <td>
        <div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
          ${d.status === 'Pending' ? `
            <button onclick="changeDepositStatus('${d.id}', 'Approved')" class="admin-nav-btn" style="background:#059669; color:#fff; padding:0.3rem 0.6rem; border:none; border-radius:6px; cursor:pointer;">Approve</button>
            <button onclick="changeDepositStatus('${d.id}', 'Rejected')" class="admin-nav-btn" style="background:#ef4444; color:#fff; padding:0.3rem 0.6rem; border:none; border-radius:6px; cursor:pointer;">Reject</button>
          ` : `<span style="color:#64748b; font-size:0.75rem;">Done</span>`}
          <button onclick="deleteRecord('deposit', '${d.id}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.3rem 0.5rem; border-radius:6px; font-weight:700; font-size:0.75rem; cursor:pointer;">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  if (tbody.innerHTML !== html) {
    tbody.innerHTML = html;
  }
}

// Receipt Image Viewer Handlers
function viewReceiptModal(src) {
  const overlay = document.getElementById('receipt-modal-overlay');
  const img = document.getElementById('receipt-modal-img');
  if (overlay && img) {
    img.src = src;
    overlay.classList.add('active');
  }
}

function closeReceiptModal() {
  const overlay = document.getElementById('receipt-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

// Approve / Reject Deposit Action
async function changeDepositStatus(depositId, status) {
  showAdminModal(
    'Confirm Deposit Action',
    `Are you sure you want to mark deposit as ${status}?`,
    'warning',
    async () => {
      try {
        const res = await fetch(`${API}/deposit-status`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AdminToken}`
          },
          body: JSON.stringify({ depositId, status })
        });
        const data = await res.json();
        if (data.success) {
          showAdminModal('Deposit Updated', data.message, 'success');
          await fetchAdminData();
        } else {
          showAdminModal('Error', data.message || 'Error updating deposit.', 'error');
        }
      } catch (err) {
        showAdminModal('Error', 'Error updating deposit.', 'error');
      }
    }
  );
}

// Withdrawals Table Renderer with Pagination & Filter
function setWithdrawalsPage(newPage) {
  const filtered = getFilteredWithdrawals();
  const maxPage = Math.max(1, Math.ceil(filtered.length / PageState.withdrawals.pageSize));
  if (newPage >= 1 && newPage <= maxPage) {
    PageState.withdrawals.page = newPage;
    renderWithdrawalsTable();
  }
}

function getFilteredWithdrawals() {
  const s = (PageState.withdrawals.search || '').toLowerCase().trim();
  if (!s) return AdminState.withdrawals;
  return AdminState.withdrawals.filter(w => 
    (w.withdrawal_ref || '').toLowerCase().includes(s) ||
    (w.username || '').toLowerCase().includes(s) ||
    (w.phone || '').toLowerCase().includes(s) ||
    (w.account_title || '').toLowerCase().includes(s) ||
    (w.account_number || '').toLowerCase().includes(s)
  );
}

function renderWithdrawalsTable() {
  const tbody = document.getElementById('adm-table-withdrawals');
  if (!tbody) return;

  const filtered = getFilteredWithdrawals();
  const pageSize = PageState.withdrawals.pageSize;
  const page = PageState.withdrawals.page;
  const start = (page - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  renderPaginationBar('adm-pagination-withdrawals', filtered.length, page, pageSize, 'setWithdrawalsPage');

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No withdrawal requests found.</td></tr>';
    return;
  }

  const html = pageData.map(w => `
    <tr>
      <td><strong>${w.withdrawal_ref}</strong></td>
      <td>${w.username}<br><small style="color:#64748b;">${w.phone}</small></td>
      <td><strong style="color:#d97706;">PKR ${w.amount.toLocaleString()}</strong></td>
      <td>${w.gateway}</td>
      <td>
        <strong>${w.account_title}</strong><br>
        <code>${w.account_number}</code>
        ${w.bank_name ? `<br><small style="color:#64748b;">${w.bank_name}</small>` : ''}
      </td>
      <td>
        <span class="status-badge status-${w.status}">${w.status}</span>
        ${w.reason ? `<br><small style="color:#ef4444; font-weight:700;">Reason: ${w.reason}</small>` : ''}
      </td>
      <td>
        <div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
          ${w.status === 'Pending' ? `
            <button onclick="changeWithdrawalStatus('${w.id}', 'Approved')" class="admin-nav-btn" style="background:#059669; color:#fff; padding:0.3rem 0.6rem; border:none; border-radius:6px; cursor:pointer;">Approve & Pay</button>
            <button onclick="changeWithdrawalStatus('${w.id}', 'Rejected')" class="admin-nav-btn" style="background:#ef4444; color:#fff; padding:0.3rem 0.6rem; border:none; border-radius:6px; cursor:pointer;">Reject & Refund</button>
          ` : `<span style="color:#64748b; font-size:0.75rem;">Done</span>`}
          <button onclick="deleteRecord('withdrawal', '${w.id}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.3rem 0.5rem; border-radius:6px; font-weight:700; font-size:0.75rem; cursor:pointer;">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  if (tbody.innerHTML !== html) {
    tbody.innerHTML = html;
  }
}

// Approve / Reject Withdrawal Action
async function changeWithdrawalStatus(withdrawalId, status) {
  if (status === 'Rejected') {
    showAdminPrompt(
      'Reject & Refund Withdrawal',
      'Enter reason for rejecting this withdrawal request (this reason will be displayed to user & balance will be refunded to user):',
      'Invalid Account Title / Number',
      async (inputReason) => {
        const reason = (inputReason || '').trim() || 'Rejected by Admin';
        await executeWithdrawalStatusChange(withdrawalId, status, reason);
      }
    );
  } else {
    showAdminModal(
      'Confirm Payout Approval',
      'Are you sure you want to approve & mark this payout request as Approved?',
      'warning',
      async () => {
        await executeWithdrawalStatusChange(withdrawalId, status, '');
      }
    );
  }
}

async function executeWithdrawalStatusChange(withdrawalId, status, reason) {
  try {
    const res = await fetch(`${API}/withdrawal-status`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AdminToken}`
      },
      body: JSON.stringify({ withdrawalId, status, reason })
    });
    const data = await res.json();
    if (data.success) {
      showAdminModal('Withdrawal Updated', data.message, 'success');
      await fetchAdminData();
    } else {
      showAdminModal('Error', data.message || 'Failed to update withdrawal status', 'error');
    }
  } catch (err) {
    showAdminModal('Error', 'Error updating withdrawal status.', 'error');
  }
}

// Plans Table Renderer with Pagination
function setPlansPage(newPage) {
  const maxPage = Math.max(1, Math.ceil(AdminState.plans.length / PageState.plans.pageSize));
  if (newPage >= 1 && newPage <= maxPage) {
    PageState.plans.page = newPage;
    renderPlansTable();
  }
}

function renderPlansTable() {
  const tbody = document.getElementById('adm-table-plans');
  if (!tbody) return;

  const total = AdminState.plans.length;
  const pageSize = PageState.plans.pageSize;
  const page = PageState.plans.page;
  const start = (page - 1) * pageSize;
  const pageData = AdminState.plans.slice(start, start + pageSize);

  renderPaginationBar('adm-pagination-plans', total, page, pageSize, 'setPlansPage');

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No VIP investment plans found.</td></tr>';
    return;
  }

  const html = pageData.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><strong style="color:#d97706;">PKR ${(p.price || 0).toLocaleString()}</strong></td>
      <td><strong style="color:#059669;">PKR ${(p.dailyProfit || p.daily_profit || 0).toLocaleString()}</strong></td>
      <td>PKR ${(p.totalProfit || p.total_profit || 0).toLocaleString()}</td>
      <td>PKR ${Math.round((p.dailyProfit || p.daily_profit || 0) * 0.10).toLocaleString()} (10%)</td>
      <td>PKR ${Math.round((p.dailyProfit || p.daily_profit || 0) * 0.02).toLocaleString()} (2%)</td>
      <td>${p.validityDays || p.validity_days || 0} Days</td>
      <td>
        <div style="display:flex; gap:0.3rem;">
          <button onclick="openPlanModal('${p.id || p._id}')" class="admin-nav-btn" style="background:#e0f2fe; color:#0369a1; padding:0.3rem 0.5rem; border:none; border-radius:6px; cursor:pointer;">✏️ Edit</button>
          <button onclick="deletePlan('${p.id || p._id}')" class="admin-nav-btn" style="background:#fee2e2; color:#dc2626; padding:0.3rem 0.5rem; border:none; border-radius:6px; cursor:pointer;">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  if (tbody.innerHTML !== html) {
    tbody.innerHTML = html;
  }
}

// Open Add/Edit VIP Plan Modal
function openPlanModal(planId = null) {
  const overlay = document.getElementById('plan-modal-overlay');
  const title = document.getElementById('plan-modal-title');
  const form = document.getElementById('plan-form');

  if (planId) {
    const plan = AdminState.plans.find(p => p.id === planId || p._id === planId);
    if (!plan) return;
    if (title) title.textContent = '✏️ Edit VIP Investment Plan';
    if (document.getElementById('modal-plan-id')) document.getElementById('modal-plan-id').value = plan.id || plan._id;
    if (document.getElementById('modal-plan-name')) document.getElementById('modal-plan-name').value = plan.name || '';
    if (document.getElementById('modal-plan-price')) document.getElementById('modal-plan-price').value = plan.price || '';
    if (document.getElementById('modal-plan-daily')) document.getElementById('modal-plan-daily').value = plan.dailyProfit || plan.daily_profit || '';
    if (document.getElementById('modal-plan-total')) document.getElementById('modal-plan-total').value = plan.totalProfit || plan.total_profit || '';
    if (document.getElementById('modal-plan-validity')) document.getElementById('modal-plan-validity').value = plan.validityDays || plan.validity_days || '';
    if (document.getElementById('modal-plan-l1')) document.getElementById('modal-plan-l1').value = plan.level1Bonus || plan.level1_bonus || '';
    if (document.getElementById('modal-plan-l2')) document.getElementById('modal-plan-l2').value = plan.level2Bonus || plan.level2_bonus || '';
  } else {
    if (title) title.textContent = '➕ Create New VIP Plan';
    if (form) form.reset();
    if (document.getElementById('modal-plan-id')) document.getElementById('modal-plan-id').value = '';
  }

  if (overlay) overlay.classList.add('active');
}

// Close Plan Modal
function closePlanModal() {
  const overlay = document.getElementById('plan-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

// Save VIP Plan (Create / Update)
async function saveAdminPlan(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const planId = document.getElementById('modal-plan-id') ? document.getElementById('modal-plan-id').value : '';
  const name = document.getElementById('modal-plan-name').value;
  const price = document.getElementById('modal-plan-price').value;
  const dailyProfit = document.getElementById('modal-plan-daily').value;
  const totalProfit = document.getElementById('modal-plan-total').value;
  const validityDays = document.getElementById('modal-plan-validity').value;
  const level1Bonus = document.getElementById('modal-plan-l1').value;
  const level2Bonus = document.getElementById('modal-plan-l2').value;

  setAdminButtonLoading(submitBtn, true, 'Saving Plan...');

  try {
    const res = await fetch(`${API}/plans`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AdminToken}`
      },
      body: JSON.stringify({
        id: planId,
        name,
        price,
        dailyProfit,
        totalProfit,
        validityDays,
        level1Bonus,
        level2Bonus
      })
    });
    const data = await res.json();
    setAdminButtonLoading(submitBtn, false);
    if (data.success) {
      showAdminModal('Plan Saved', data.message, 'success');
      closePlanModal();
      await fetchAdminData();
    } else {
      showAdminModal('Error', data.message || 'Failed to save plan', 'error');
    }
  } catch (err) {
    setAdminButtonLoading(submitBtn, false);
    showAdminModal('Error', 'Error saving VIP plan.', 'error');
  }
}
const saveVipPlan = saveAdminPlan;

// Delete VIP Plan
async function deletePlan(planId) {
  showAdminModal(
    'Delete VIP Plan',
    'Are you sure you want to delete this VIP plan from database?',
    'warning',
    async () => {
      try {
        const res = await fetch(`${API}/plans?id=${planId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${AdminToken}`
          }
        });
        const data = await res.json();
        if (data.success) {
          showAdminModal('Plan Deleted', data.message, 'success');
          await fetchAdminData();
        } else {
          showAdminModal('Error', data.message || 'Failed to delete plan', 'error');
        }
      } catch (err) {
        showAdminModal('Error', 'Error deleting VIP plan.', 'error');
      }
    }
  );
}

// Render Settings Form
function renderSettingsForm() {
  const s = AdminState.settings;
  if (!s) return;

  const epTitle = document.getElementById('sett-ep-title');
  const epNum = document.getElementById('sett-ep-num');
  const waNum = document.getElementById('sett-wa-num');
  const notice = document.getElementById('sett-notice');

  if (epTitle) epTitle.value = s.easypaisa_title || s.easypaisaTitle || '';
  if (epNum) epNum.value = s.easypaisa_number || s.easypaisaNumber || '';
  if (waNum) waNum.value = s.whatsapp_number || s.whatsappNumber || '';
  if (notice) notice.value = s.notice_text || s.noticeText || '';
}

// Save Admin Settings
async function saveAdminSettings(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const settings = {
    easypaisa_title: document.getElementById('sett-ep-title').value,
    easypaisaTitle: document.getElementById('sett-ep-title').value,
    easypaisa_number: document.getElementById('sett-ep-num').value,
    easypaisaNumber: document.getElementById('sett-ep-num').value,
    whatsapp_number: document.getElementById('sett-wa-num').value,
    whatsappNumber: document.getElementById('sett-wa-num').value,
    notice_text: document.getElementById('sett-notice').value,
    noticeText: document.getElementById('sett-notice').value
  };

  setAdminButtonLoading(submitBtn, true, 'Saving Settings...');

  try {
    const res = await fetch(`${API}/settings-save`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AdminToken}`
      },
      body: JSON.stringify({ settings })
    });
    const data = await res.json();
    setAdminButtonLoading(submitBtn, false);
    if (data.success) {
      showAdminModal('Settings Saved', data.message, 'success');
      await fetchAdminData();
    }
  } catch (err) {
    setAdminButtonLoading(submitBtn, false);
    showAdminModal('Error', 'Error saving settings.', 'error');
  }
}

// Active User Mining Packages Table Renderer with Pagination
function setUserPlansPage(newPage) {
  const total = AdminState.activeUserPlans.length;
  const maxPage = Math.max(1, Math.ceil(total / PageState.userPlans.pageSize));
  if (newPage >= 1 && newPage <= maxPage) {
    PageState.userPlans.page = newPage;
    renderUserPlansTable();
  }
}

function renderUserPlansTable() {
  const tbody = document.getElementById('adm-table-user-plans');
  if (!tbody) return;

  const plans = AdminState.activeUserPlans || [];
  const pageSize = PageState.userPlans.pageSize;
  const page = PageState.userPlans.page;
  const start = (page - 1) * pageSize;
  const pageData = plans.slice(start, start + pageSize);

  renderPaginationBar('adm-pagination-user-plans', plans.length, page, pageSize, 'setUserPlansPage');

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No active user mining packages found.</td></tr>';
    return;
  }

  const html = pageData.map(up => {
    const id = up._id || up.id;
    const planName = up.planName || up.plan_name || 'VIP Package';
    const userId = up.userId || up.user_id || 'User';
    const investment = Number(up.investment || 0);
    const dailyProfit = Number(up.dailyProfit || up.daily_profit || 0);
    const claimsCount = Number(up.claimsCount || up.claims_count || 0);
    const validityDays = Number(up.validityDays || up.validity_days || 12);
    const status = up.status || 'Active';

    return `
      <tr>
        <td><strong>${planName}</strong></td>
        <td><code>${userId}</code></td>
        <td>PKR ${investment.toLocaleString()}</td>
        <td><strong style="color:var(--emerald-green);">PKR ${dailyProfit.toLocaleString()}</strong></td>
        <td>${claimsCount}/${validityDays} Days</td>
        <td><span class="status-badge status-${status}">${status}</span></td>
        <td>
          <button onclick="deleteRecord('userPlan', '${id}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.3rem 0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">🗑️ Cancel Plan</button>
        </td>
      </tr>
    `;
  }).join('');

  if (tbody.innerHTML !== html) {
    tbody.innerHTML = html;
  }
}

// Users Manager Table Renderer with Pagination & Filter
function setUsersPage(newPage) {
  const filtered = getFilteredUsers();
  const maxPage = Math.max(1, Math.ceil(filtered.length / PageState.users.pageSize));
  if (newPage >= 1 && newPage <= maxPage) {
    PageState.users.page = newPage;
    renderUsersTable();
  }
}

function getFilteredUsers() {
  const s = (PageState.users.search || '').toLowerCase().trim();
  if (!s) return AdminState.users;
  return AdminState.users.filter(u => 
    (u.username || '').toLowerCase().includes(s) ||
    (u.email || '').toLowerCase().includes(s) ||
    (u.phone || '').toLowerCase().includes(s) ||
    (u.id || '').toString().toLowerCase().includes(s) ||
    (u.referral_code || '').toLowerCase().includes(s)
  );
}

function renderUsersTable() {
  const tbody = document.getElementById('adm-table-users');
  if (!tbody) return;

  const filtered = getFilteredUsers();
  const pageSize = PageState.users.pageSize;
  const page = PageState.users.page;
  const start = (page - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  renderPaginationBar('adm-pagination-users', filtered.length, page, pageSize, 'setUsersPage');

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No users found matching search query.</td></tr>';
    return;
  }

  const html = pageData.map(u => `
    <tr>
      <td><small><code>${u.id || u._id}</code></small></td>
      <td>
        <strong>${u.username || 'User'}</strong>
        ${u.email ? `<br><small style="color:#2563eb; font-weight:600;">📧 ${u.email}</small>` : ''}
      </td>
      <td>${u.phone || '-'}</td>
      <td><strong style="color:#059669;">PKR ${(u.balance || 0).toLocaleString()}</strong></td>
      <td>PKR ${(u.total_deposit || u.totalDeposit || 0).toLocaleString()}</td>
      <td>PKR ${(u.total_withdraw || u.totalWithdraw || 0).toLocaleString()}</td>
      <td><code>${u.referral_code || u.referralCode || '-'}</code></td>
      <td>${u.referred_by || u.referredBy || '-'}</td>
      <td>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <button onclick="editUserWalletBalance('${u.id || u._id}', ${u.balance || 0})" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:0.35rem 0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">✏️ Balance</button>
          <button onclick="openUserEditModal('${u.id || u._id}')" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:0.35rem 0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">🔐 Edit / Reset</button>
          <button onclick="deleteUserAccount('${u.id || u._id}', '${u.username || 'User'}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.35rem 0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  if (tbody.innerHTML !== html) {
    tbody.innerHTML = html;
  }
}

// Edit User Wallet Balance Action
async function editUserWalletBalance(userId, currentBal) {
  showAdminPrompt(
    'Edit User Wallet Balance',
    'Enter new wallet balance for this user (PKR):',
    currentBal,
    async (newBal) => {
      if (newBal === null || newBal === undefined || newBal === '') return;
      try {
        const res = await fetch(`${API}/edit-user-balance`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AdminToken}`
          },
          body: JSON.stringify({ userId, balance: newBal })
        });
        const data = await res.json();
        if (data.success) {
          showAdminModal('Balance Updated', data.message, 'success');
          await fetchAdminData();
        } else {
          showAdminModal('Error', data.message || 'Error updating user balance.', 'error');
        }
      } catch (err) {
        showAdminModal('Error', 'Error updating user balance.', 'error');
      }
    }
  );
}

// Open Edit User Account Modal
function openUserEditModal(userId) {
  const user = AdminState.users.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('edit-user-id').value = userId;
  document.getElementById('edit-user-username').value = user.username || '';
  document.getElementById('edit-user-phone').value = user.phone || '';
  document.getElementById('edit-user-balance').value = user.balance || 0;
  document.getElementById('edit-user-password').value = '';

  const overlay = document.getElementById('user-edit-modal-overlay');
  if (overlay) overlay.classList.add('active');
}

// Close Edit User Modal
function closeUserEditModal() {
  const overlay = document.getElementById('user-edit-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

// Save Edit User Details & Reset Password
async function saveEditedUserDetails(e) {
  e.preventDefault();
  const userId = document.getElementById('edit-user-id').value;
  const username = document.getElementById('edit-user-username').value;
  const phone = document.getElementById('edit-user-phone').value;
  const balance = document.getElementById('edit-user-balance').value;
  const newPassword = document.getElementById('edit-user-password').value;

  try {
    const res = await fetch(`${API}/edit-user-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AdminToken}`
      },
      body: JSON.stringify({ userId, username, phone, balance, newPassword })
    });
    const data = await res.json();
    if (data.success) {
      showAdminModal('User Account Updated', data.message, 'success');
      closeUserEditModal();
      await fetchAdminData();
    } else {
      showAdminModal('Error', data.message || 'Failed to update user.', 'error');
    }
  } catch (err) {
    showAdminModal('Error', 'Error updating user account.', 'error');
  }
}

// Delete User Account (Cascade Deletion)
async function deleteUserAccount(userId, username) {
  showAdminModal(
    '⚠️ PERMANENTLY DELETE USER',
    `DANGER: Are you sure you want to PERMANENTLY DELETE user "${username}"?\n\nThis will delete their user account, all deposits, withdrawals, and active mining plans!`,
    'warning',
    async () => {
      try {
        const res = await fetch(`${API}/delete-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AdminToken}`
          },
          body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (data.success) {
          showAdminModal('User Deleted', data.message, 'success');
          await fetchAdminData();
        } else {
          showAdminModal('Error', data.message || 'Failed to delete user.', 'error');
        }
      } catch (err) {
        showAdminModal('Error', 'Error deleting user account.', 'error');
      }
    }
  );
}

// Delete Specific Record (Deposit / Withdrawal / User Plan)
async function deleteRecord(type, id) {
  showAdminModal(
    'Delete Record',
    `Are you sure you want to delete this ${type} record?`,
    'warning',
    async () => {
      try {
        const res = await fetch(`${API}/delete-record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AdminToken}`
          },
          body: JSON.stringify({ type, id })
        });
        const data = await res.json();
        if (data.success) {
          showAdminModal('Record Deleted', data.message, 'success');
          await fetchAdminData();
        } else {
          showAdminModal('Error', data.message || 'Failed to delete record.', 'error');
        }
      } catch (err) {
        showAdminModal('Error', 'Error deleting record.', 'error');
      }
    }
  );
}
