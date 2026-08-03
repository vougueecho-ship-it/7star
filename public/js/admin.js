/* 7 STAR INVEST - Admin Control Panel Handler */

const API_BASE = '/api';
let AdminToken = localStorage.getItem('star_admin_token') || null;
let AdminData = {
  settings: {},
  plans: [],
  users: [],
  deposits: [],
  withdrawals: []
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!AdminToken && !window.location.pathname.includes('/xpro-admin/login.html')) {
    window.location.href = '/xpro-admin/login.html';
    return;
  }
  await fetchAdminData();
});

function getAdminHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AdminToken}`
  };
}

async function fetchAdminData() {
  try {
    const res = await fetch(`${API_BASE}/admin/data`, {
      headers: getAdminHeaders()
    });
    if (res.status === 401) {
      window.location.href = '/xpro-admin/login.html';
      return;
    }
    const data = await res.json();
    AdminData = data;
    renderAdminOverview();
    renderPendingDeposits();
    renderPendingWithdrawals();
    renderAdminUsers();
    renderAdminSettings();
    renderAdminPlans();
  } catch (err) {
    console.error("Failed to load admin data:", err);
  }
}

// Render Overview Statistics
function renderAdminOverview() {
  const userCount = document.getElementById('adm-total-users');
  const depCount = document.getElementById('adm-total-deposits');
  const witCount = document.getElementById('adm-total-withdrawals');
  const pendingDep = document.getElementById('adm-pending-deposits');
  const pendingWit = document.getElementById('adm-pending-withdrawals');

  if (userCount && AdminData.users) userCount.textContent = AdminData.users.length;
  
  if (AdminData.deposits) {
    const totalDepSum = AdminData.deposits
      .filter(d => d.status === 'Approved')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
    if (depCount) depCount.textContent = `PKR ${totalDepSum.toLocaleString()}`;

    const pDepCount = AdminData.deposits.filter(d => d.status === 'Pending').length;
    if (pendingDep) pendingDep.textContent = pDepCount;
  }

  if (AdminData.withdrawals) {
    const totalWitSum = AdminData.withdrawals
      .filter(w => w.status === 'Approved')
      .reduce((sum, w) => sum + (w.amount || 0), 0);
    if (witCount) witCount.textContent = `PKR ${totalWitSum.toLocaleString()}`;

    const pWitCount = AdminData.withdrawals.filter(w => w.status === 'Pending').length;
    if (pendingWit) pendingWit.textContent = pWitCount;
  }
}

// Render Pending Deposits Table
function renderPendingDeposits() {
  const container = document.getElementById('adm-deposits-table');
  if (!container) return;

  if (!AdminData.deposits || AdminData.deposits.length === 0) {
    container.innerHTML = '<tr><td colspan="7" style="text-align:center;">No deposit records found.</td></tr>';
    return;
  }

  container.innerHTML = AdminData.deposits.map(dep => `
    <tr>
      <td><strong>${dep.deposit_ref || dep.id}</strong></td>
      <td>${dep.username || dep.userName}<br><small style="color:var(--text-muted);">${dep.phone || dep.userPhone}</small></td>
      <td><strong style="color:var(--cyan-neon);">PKR ${(dep.amount || 0).toLocaleString()}</strong></td>
      <td><span class="badge-badge" style="color:var(--primary-gold);">${dep.gateway}</span></td>
      <td><code>${dep.tid}</code></td>
      <td><span class="badge-status ${dep.status}">${dep.status}</span></td>
      <td>
        ${dep.status === 'Pending' ? `
          <button onclick="updateDepositStatus('${dep.id}', 'Approved')" class="btn btn-gold btn-sm">Approve</button>
          <button onclick="updateDepositStatus('${dep.id}', 'Rejected')" class="btn btn-outline btn-sm" style="color:var(--accent-red); border-color:var(--accent-red);">Reject</button>
        ` : `<span style="color:var(--text-muted);">Handled</span>`}
      </td>
    </tr>
  `).join('');
}

// Update Deposit Status
async function updateDepositStatus(depositId, status) {
  if (confirm(`Are you sure you want to mark deposit as ${status}?`)) {
    try {
      const res = await fetch(`${API_BASE}/admin/deposit-status`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ depositId, status })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        await fetchAdminData();
      } else {
        alert(data.message || 'Failed to update deposit');
      }
    } catch (err) {
      alert('Error updating deposit.');
    }
  }
}

// Render Pending Withdrawals Table
function renderPendingWithdrawals() {
  const container = document.getElementById('adm-withdrawals-table');
  if (!container) return;

  if (!AdminData.withdrawals || AdminData.withdrawals.length === 0) {
    container.innerHTML = '<tr><td colspan="7" style="text-align:center;">No withdrawal records found.</td></tr>';
    return;
  }

  container.innerHTML = AdminData.withdrawals.map(wit => `
    <tr>
      <td><strong>${wit.withdrawal_ref || wit.id}</strong></td>
      <td>${wit.username || wit.userName}<br><small style="color:var(--text-muted);">${wit.phone || wit.userPhone}</small></td>
      <td><strong style="color:var(--primary-gold);">PKR ${(wit.amount || 0).toLocaleString()}</strong></td>
      <td>${wit.gateway}</td>
      <td><strong>${wit.account_title || wit.accountTitle}</strong><br><code>${wit.account_number || wit.accountNumber}</code></td>
      <td><span class="badge-status ${wit.status}">${wit.status}</span></td>
      <td>
        ${wit.status === 'Pending' ? `
          <button onclick="updateWithdrawalStatus('${wit.id}', 'Approved')" class="btn btn-cyan btn-sm">Approve & Pay</button>
          <button onclick="updateWithdrawalStatus('${wit.id}', 'Rejected')" class="btn btn-outline btn-sm" style="color:var(--accent-red); border-color:var(--accent-red);">Reject & Refund</button>
        ` : `<span style="color:var(--text-muted);">Handled</span>`}
      </td>
    </tr>
  `).join('');
}

// Update Withdrawal Status
async function updateWithdrawalStatus(withdrawalId, status) {
  if (confirm(`Are you sure you want to mark withdrawal as ${status}?`)) {
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawal-status`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ withdrawalId, status })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        await fetchAdminData();
      } else {
        alert(data.message || 'Failed to update withdrawal');
      }
    } catch (err) {
      alert('Error updating withdrawal.');
    }
  }
}

// Render Admin Users List
function renderAdminUsers() {
  const container = document.getElementById('adm-users-table');
  if (!container || !AdminData.users) return;

  container.innerHTML = AdminData.users.map(u => `
    <tr>
      <td><strong>${u.id}</strong></td>
      <td>${u.username || u.name}</td>
      <td>${u.phone}</td>
      <td><strong style="color:var(--accent-green);">PKR ${(u.balance || 0).toLocaleString()}</strong></td>
      <td>PKR ${(u.total_deposit || u.totalDeposit || 0).toLocaleString()}</td>
      <td>PKR ${(u.total_withdraw || u.totalWithdraw || 0).toLocaleString()}</td>
      <td><code>${u.referral_code || u.referralCode}</code></td>
      <td>
        <button onclick="editUserBalance('${u.id}', ${u.balance || 0})" class="btn btn-outline btn-sm">Edit Balance</button>
      </td>
    </tr>
  `).join('');
}

// Edit User Balance Action
async function editUserBalance(userId, currentBal) {
  const newBal = prompt("Enter new wallet balance for this user in PKR:", currentBal);
  if (newBal !== null) {
    try {
      const res = await fetch(`${API_BASE}/admin/edit-user-balance`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ userId, balance: newBal })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        await fetchAdminData();
      } else {
        alert(data.message || 'Failed to update user balance');
      }
    } catch (err) {
      alert('Error updating balance.');
    }
  }
}

// Render Admin Settings Form
function renderAdminSettings() {
  const s = AdminData.settings;
  if (!s) return;

  const epTitle = document.getElementById('sett-ep-title');
  const epNum = document.getElementById('sett-ep-num');
  const jcTitle = document.getElementById('sett-jc-title');
  const jcNum = document.getElementById('sett-jc-num');
  const notice = document.getElementById('sett-notice');

  if (epTitle) epTitle.value = s.easypaisa_title || s.easypaisaTitle || '';
  if (epNum) epNum.value = s.easypaisa_number || s.easypaisaNumber || '';
  if (jcTitle) jcTitle.value = s.jazzcash_title || s.jazzcashTitle || '';
  if (jcNum) jcNum.value = s.jazzcash_number || s.jazzcashNumber || '';
  if (notice) notice.value = s.notice_text || s.noticeText || '';
}

// Save Admin Settings
async function saveAdminSettings(e) {
  e.preventDefault();
  const settings = {
    easypaisa_title: document.getElementById('sett-ep-title').value,
    easypaisa_number: document.getElementById('sett-ep-num').value,
    jazzcash_title: document.getElementById('sett-jc-title').value,
    jazzcash_number: document.getElementById('sett-jc-num').value,
    notice_text: document.getElementById('sett-notice').value
  };

  try {
    const res = await fetch(`${API_BASE}/admin/settings-save`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ settings })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      await fetchAdminData();
    } else {
      alert(data.message || 'Failed to save settings');
    }
  } catch (err) {
    alert('Error saving settings.');
  }
}

// Render Admin Plans Manager Table
function renderAdminPlans() {
  const container = document.getElementById('adm-plans-table');
  if (!container || !AdminData.plans) return;

  container.innerHTML = AdminData.plans.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>PKR ${(p.price || 0).toLocaleString()}</td>
      <td>PKR ${p.daily_profit || p.dailyProfit || 0}</td>
      <td>PKR ${p.level1_bonus || p.level1Bonus || 0}</td>
      <td>PKR ${p.level2_bonus || p.level2Bonus || 0}</td>
      <td>${p.validity_days || p.durationDays || p.validityDays || 40} Days</td>
    </tr>
  `).join('');
}
