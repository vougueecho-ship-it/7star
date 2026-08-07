/* 7 STAR INVEST - Admin Portal Controller */

const API = '/api/admin';
let AdminToken = localStorage.getItem('star_admin_token') || null;
let AdminState = {
  users: [],
  deposits: [],
  withdrawals: [],
  plans: [],
  settings: {}
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

document.addEventListener('DOMContentLoaded', async () => {
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
    renderOverviewStats();
    renderDepositsTable();
    renderWithdrawalsTable();
    renderPlansTable();
    renderUserPlansTable();
    
    // Only update settings form if not focused/typing currently
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

// Render Deposits Table
function renderDepositsTable() {
  const tbody = document.getElementById('adm-table-deposits');
  if (!tbody) return;

  if (AdminState.deposits.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No deposit records found.</td></tr>';
    return;
  }

  tbody.innerHTML = AdminState.deposits.map(d => `
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

// Render Withdrawals Table
function renderWithdrawalsTable() {
  const tbody = document.getElementById('adm-table-withdrawals');
  if (!tbody) return;

  if (AdminState.withdrawals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No withdrawal requests found.</td></tr>';
    return;
  }

  tbody.innerHTML = AdminState.withdrawals.map(w => `
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

// Render Plans Table
function renderPlansTable() {
  const tbody = document.getElementById('adm-table-plans');
  if (!tbody) return;

  if (AdminState.plans.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No VIP investment plans found.</td></tr>';
    return;
  }

  tbody.innerHTML = AdminState.plans.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><strong style="color:#d97706;">PKR ${p.price.toLocaleString()}</strong></td>
      <td><strong style="color:#059669;">PKR ${p.dailyProfit.toLocaleString()}</strong></td>
      <td>PKR ${p.totalProfit.toLocaleString()}</td>
      <td>${p.validityDays} Days</td>
      <td>${p.level1Bonus}%</td>
      <td>${p.level2Bonus}%</td>
      <td>
        <div style="display:flex; gap:0.3rem;">
          <button onclick="openPlanModal('${p.id}')" class="admin-nav-btn" style="background:#e0f2fe; color:#0369a1; padding:0.3rem 0.5rem; border:none; border-radius:6px; cursor:pointer;">✏️ Edit</button>
          <button onclick="deletePlan('${p.id}')" class="admin-nav-btn" style="background:#fee2e2; color:#dc2626; padding:0.3rem 0.5rem; border:none; border-radius:6px; cursor:pointer;">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Open Add/Edit VIP Plan Modal
function openPlanModal(planId = null) {
  const overlay = document.getElementById('plan-modal-overlay');
  const title = document.getElementById('plan-modal-title');
  const form = document.getElementById('plan-form');

  if (planId) {
    const plan = AdminState.plans.find(p => p.id === planId);
    if (!plan) return;
    title.textContent = '✏️ Edit VIP Investment Plan';
    document.getElementById('plan-id').value = plan.id;
    document.getElementById('plan-name').value = plan.name;
    document.getElementById('plan-price').value = plan.price;
    document.getElementById('plan-daily').value = plan.dailyProfit;
    document.getElementById('plan-total').value = plan.totalProfit;
    document.getElementById('plan-validity').value = plan.validityDays;
    document.getElementById('plan-level1').value = plan.level1Bonus;
    document.getElementById('plan-level2').value = plan.level2Bonus;
  } else {
    title.textContent = '➕ Create New VIP Plan';
    form.reset();
    document.getElementById('plan-id').value = '';
  }

  if (overlay) overlay.classList.add('active');
}

// Close Plan Modal
function closePlanModal() {
  const overlay = document.getElementById('plan-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

// Save VIP Plan (Create / Update)
async function saveVipPlan(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const planId = document.getElementById('plan-id').value;
  const name = document.getElementById('plan-name').value;
  const price = document.getElementById('plan-price').value;
  const dailyProfit = document.getElementById('plan-daily').value;
  const totalProfit = document.getElementById('plan-total').value;
  const validityDays = document.getElementById('plan-validity').value;
  const level1Bonus = document.getElementById('plan-level1').value;
  const level2Bonus = document.getElementById('plan-level2').value;

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

  if (epTitle) epTitle.value = s.easypaisa_title || '';
  if (epNum) epNum.value = s.easypaisa_number || '';
  if (waNum) waNum.value = s.whatsapp_number || s.whatsappNumber || '';
  if (notice) notice.value = s.notice_text || '';
}

// Save Admin Settings
async function saveAdminSettings(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const settings = {
    easypaisa_title: document.getElementById('sett-ep-title').value,
    easypaisa_number: document.getElementById('sett-ep-num').value,
    whatsapp_number: document.getElementById('sett-wa-num').value,
    notice_text: document.getElementById('sett-notice').value
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

// Render Active User Mining Packages Table
function renderUserPlansTable() {
  const tbody = document.getElementById('adm-table-user-plans');
  if (!tbody) return;

  const plans = AdminState.activeUserPlans || [];
  if (plans.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No active user mining packages found.</td></tr>';
    return;
  }

  tbody.innerHTML = plans.map(up => {
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
}

// Filter Users Table by Search Query
function filterUsersTable() {
  const searchVal = (document.getElementById('adm-user-search')?.value || '').toLowerCase().trim();
  if (!searchVal) {
    renderUsersTable();
    return;
  }

  const filtered = AdminState.users.filter(u => 
    (u.username || '').toLowerCase().includes(searchVal) ||
    (u.phone || '').toLowerCase().includes(searchVal) ||
    (u.id || '').toString().toLowerCase().includes(searchVal)
  );

  renderUsersTable(filtered);
}

// Render Registered Users Table
function renderUsersTable(usersToRender = null) {
  const tbody = document.getElementById('adm-table-users');
  if (!tbody) return;

  const usersList = usersToRender || AdminState.users;

  if (usersList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No users found matching search query.</td></tr>';
    return;
  }

  tbody.innerHTML = usersList.map(u => `
    <tr>
      <td><small><code>${u.id}</code></small></td>
      <td><strong>${u.username}</strong></td>
      <td>${u.phone}</td>
      <td><strong style="color:#059669;">PKR ${u.balance.toLocaleString()}</strong></td>
      <td>PKR ${u.total_deposit.toLocaleString()}</td>
      <td>PKR ${u.total_withdraw.toLocaleString()}</td>
      <td><code>${u.referral_code}</code></td>
      <td>${u.referred_by || '-'}</td>
      <td>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <button onclick="editUserWalletBalance('${u.id}', ${u.balance})" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:0.35rem 0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">✏️ Balance</button>
          <button onclick="openUserEditModal('${u.id}')" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:0.35rem 0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">🔐 Edit / Reset</button>
          <button onclick="deleteUserAccount('${u.id}', '${u.username}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.35rem 0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
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
