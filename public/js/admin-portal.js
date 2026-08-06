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

document.addEventListener('DOMContentLoaded', async () => {
  const isLoginPage = window.location.pathname.includes('/xpro-admin/login.html');
  
  if (!isLoginPage && !AdminToken) {
    window.location.href = '/xpro-admin/login.html';
    return;
  }

  if (!isLoginPage && AdminToken) {
    await fetchAdminData();
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
      alert('Admin authenticated successfully!');
      window.location.href = '/xpro-admin/dashboard.html';
    } else {
      setAdminButtonLoading(submitBtn, false);
      alert(data.message);
    }
  } catch (err) {
    setAdminButtonLoading(submitBtn, false);
    alert('Login error. Please check backend server.');
  }
}

// Admin Logout
function adminLogout() {
  localStorage.removeItem('star_admin_token');
  window.location.href = '/xpro-admin/login.html';
}

// Fetch Complete Admin Real-Time Data from SQLite
async function fetchAdminData() {
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
    renderSettingsForm();
    renderUsersTable();
  } catch (err) {
    console.error("Failed to load admin data:", err);
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
  if (confirm(`Are you sure you want to mark deposit as ${status}?`)) {
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
        alert(data.message);
        await fetchAdminData();
      }
    } catch (err) {
      alert('Error updating deposit.');
    }
  }
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
      <td><span class="status-badge status-${w.status}">${w.status}</span></td>
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
  if (confirm(`Are you sure you want to mark payout request as ${status}?`)) {
    try {
      const res = await fetch(`${API}/withdrawal-status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AdminToken}`
        },
        body: JSON.stringify({ withdrawalId, status })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        await fetchAdminData();
      }
    } catch (err) {
      alert('Error updating withdrawal.');
    }
  }
}

// Render Plans Table
function renderPlansTable() {
  const tbody = document.getElementById('adm-table-plans');
  if (!tbody) return;

  if (!AdminState.plans || AdminState.plans.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No VIP plans found. Click "+ Add New VIP Plan" above to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = AdminState.plans.map(p => {
    const planId = p._id || p.id;
    return `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><strong style="color:var(--primary-gold);">PKR ${(p.price || 0).toLocaleString()}</strong></td>
      <td>PKR ${(p.daily_profit || p.dailyProfit || 0).toLocaleString()}</td>
      <td>PKR ${(p.total_profit || p.totalProfit || 0).toLocaleString()}</td>
      <td>PKR ${p.level1_bonus || p.level1Bonus || 0}</td>
      <td>PKR ${p.level2_bonus || p.level2Bonus || 0}</td>
      <td>${p.validity_days || p.validityDays || 40} Days</td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <button onclick="openPlanModal('${planId}')" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:0.3rem 0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">✏️ Edit</button>
          <button onclick="deletePlan('${planId}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.3rem 0.6rem; border-radius:8px; font-weight:700; font-size:0.75rem; cursor:pointer;">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `}).join('');
}

// Open Plan Modal
function openPlanModal(planId = null) {
  const modal = document.getElementById('plan-modal-overlay');
  const title = document.getElementById('plan-modal-title');
  const idInput = document.getElementById('modal-plan-id');
  const nameInput = document.getElementById('modal-plan-name');
  const priceInput = document.getElementById('modal-plan-price');
  const dailyInput = document.getElementById('modal-plan-daily');
  const totalInput = document.getElementById('modal-plan-total');
  const validityInput = document.getElementById('modal-plan-validity');
  const l1Input = document.getElementById('modal-plan-l1');
  const l2Input = document.getElementById('modal-plan-l2');

  if (!modal) return;

  if (planId) {
    const plan = AdminState.plans.find(p => (p._id || p.id) === planId);
    if (plan) {
      title.textContent = `Edit ${plan.name}`;
      idInput.value = planId;
      nameInput.value = plan.name || '';
      priceInput.value = plan.price || '';
      dailyInput.value = plan.daily_profit || plan.dailyProfit || '';
      totalInput.value = plan.total_profit || plan.totalProfit || '';
      validityInput.value = plan.validity_days || plan.validityDays || 40;
      l1Input.value = plan.level1_bonus || plan.level1Bonus || '';
      l2Input.value = plan.level2_bonus || plan.level2Bonus || '';
    }
  } else {
    title.textContent = 'Add New VIP Plan';
    idInput.value = '';
    nameInput.value = '';
    priceInput.value = '';
    dailyInput.value = '';
    totalInput.value = '';
    validityInput.value = '40';
    l1Input.value = '';
    l2Input.value = '';
  }

  modal.classList.add('active');
}

// Close Plan Modal
function closePlanModal() {
  const modal = document.getElementById('plan-modal-overlay');
  if (modal) modal.classList.remove('active');
}

// Save VIP Plan (Create / Edit)
async function saveAdminPlan(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const planId = document.getElementById('modal-plan-id').value;
  const name = document.getElementById('modal-plan-name').value;
  const price = document.getElementById('modal-plan-price').value;
  const dailyProfit = document.getElementById('modal-plan-daily').value;
  const totalProfit = document.getElementById('modal-plan-total').value;
  const validityDays = document.getElementById('modal-plan-validity').value;
  const level1Bonus = document.getElementById('modal-plan-l1').value;
  const level2Bonus = document.getElementById('modal-plan-l2').value;

  setAdminButtonLoading(submitBtn, true, 'Saving VIP Plan...');

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
    if (data.success) {
      alert(data.message);
      closePlanModal();
      setAdminButtonLoading(submitBtn, false);
      await fetchAdminData();
    } else {
      setAdminButtonLoading(submitBtn, false);
      alert(data.message || 'Failed to save plan');
    }
  } catch (err) {
    setAdminButtonLoading(submitBtn, false);
    alert('Error saving VIP plan.');
  }
}

// Delete VIP Plan
async function deletePlan(planId) {
  if (!confirm('Are you sure you want to delete this VIP plan from database?')) return;

  try {
    const res = await fetch(`${API}/plans?id=${planId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AdminToken}`
      }
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      await fetchAdminData();
    } else {
      alert(data.message || 'Failed to delete plan');
    }
  } catch (err) {
    alert('Error deleting VIP plan.');
  }
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
    if (data.success) {
      alert(data.message);
      setAdminButtonLoading(submitBtn, false);
      await fetchAdminData();
    }
  } catch (err) {
    setAdminButtonLoading(submitBtn, false);
    alert('Error saving settings.');
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
  const newBal = prompt("Enter new wallet balance for this user (PKR):", currentBal);
  if (newBal !== null) {
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
        alert(data.message);
        await fetchAdminData();
      }
    } catch (err) {
      alert('Error updating user balance.');
    }
  }
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
      alert(data.message);
      closeUserEditModal();
      await fetchAdminData();
    } else {
      alert(data.message || 'Failed to update user.');
    }
  } catch (err) {
    alert('Error updating user account.');
  }
}

// Delete User Account (Cascade Deletion)
async function deleteUserAccount(userId, username) {
  if (!confirm(`⚠️ DANGER: Are you sure you want to PERMANENTLY DELETE user "${username}"?\n\nThis will delete their user account, all deposits, withdrawals, and active mining plans!`)) return;

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
      alert(data.message);
      await fetchAdminData();
    } else {
      alert(data.message || 'Failed to delete user.');
    }
  } catch (err) {
    alert('Error deleting user account.');
  }
}

// Delete Specific Record (Deposit / Withdrawal / User Plan)
async function deleteRecord(type, id) {
  if (!confirm(`Are you sure you want to delete this ${type} record?`)) return;

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
      alert(data.message);
      await fetchAdminData();
    } else {
      alert(data.message || 'Failed to delete record.');
    }
  } catch (err) {
    alert('Error deleting record.');
  }
}
