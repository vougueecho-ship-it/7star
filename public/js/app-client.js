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
    const token = localStorage.getItem('star_token');
    if (token) {
      if (currentPath === '/' || currentPath.endsWith('/index.html') || currentPath.endsWith('/login.html')) {
        window.location.href = '/dashboard.html';
        return;
      }
    } else {
      if (currentPath === '/' || currentPath.endsWith('/index.html')) {
        window.location.href = '/login.html';
        return;
      }
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
  setupPullToRefresh();
  
  // 0. Auto-Purge any legacy Service Worker caches to force fresh HTML load
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.update();
      }
    });
    if (window.caches) {
      caches.keys().then(keys => {
        keys.forEach(key => {
          if (key.includes('7star-invest-v1')) {
            caches.delete(key);
          }
        });
      });
    }
  }

  // 1. Hydrate UI immediately from local storage cache (Zero Dummy Data Flash)
  hydrateFromCache();
  updateClientUI();

  // 2. Initial Async Server Sync
  await loadConfig();
  if (AppState.token) {
    await fetchUserProfile();
  }

  // 3. Setup Automatic Background Real-Time Auto-Polling Loops
  startRealtimeAutoSync();

  // Pre-fill deposit amount if redirected from plan activation
  const urlParams = new URLSearchParams(window.location.search);
  const paramAmount = urlParams.get('amount');
  if (paramAmount) {
    const depAmountElem = document.getElementById('dep-amount');
    if (depAmountElem) {
      depAmountElem.value = paramAmount;
      setTimeout(() => {
        depAmountElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        depAmountElem.focus();
      }, 300);
    }
  }
});

// Immediate Local Storage Hydration
function hydrateFromCache() {
  const cachedConfig = localStorage.getItem('star_config');
  if (cachedConfig) {
    try {
      const configObj = JSON.parse(cachedConfig);
      AppState.config = configObj;
      if (configObj.plans) renderPlans(configObj.plans);
      if (configObj.settings) {
        renderNotice(configObj.settings.notice_text);
        renderGatewayDetails(configObj.settings);
      }
    } catch (e) {}
  }

  const cachedProfile = localStorage.getItem('star_profile_cache');
  if (cachedProfile && AppState.user) {
    try {
      const profileObj = JSON.parse(cachedProfile);
      const currentUserId = AppState.user.id || AppState.user._id;
      const cachedUserId = profileObj.user ? (profileObj.user.id || profileObj.user._id) : null;

      // Only hydrate profile if user ID matches active session token
      if (cachedUserId && String(cachedUserId) === String(currentUserId)) {
        AppState.user = profileObj.user;
        if (profileObj.activePlans) AppState.activePlans = profileObj.activePlans;
        renderUserRecords(profileObj);
        const teamCountElem = document.getElementById('user-dyn-teamcount');
        if (teamCountElem) teamCountElem.textContent = profileObj.teamCount || '0';
      } else {
        localStorage.removeItem('star_profile_cache');
      }
    } catch (e) {}
  }
}

// Background Real-Time Auto-Polling & Focus Sync
let userPollInterval = null;
let configPollInterval = null;

function startRealtimeAutoSync() {
  if (userPollInterval) clearInterval(userPollInterval);
  if (configPollInterval) clearInterval(configPollInterval);

  // Poll User Profile every 4 seconds for real-time balance & transaction updates
  userPollInterval = setInterval(() => {
    if (AppState.token && !document.hidden) {
      fetchUserProfile(true);
    }
  }, 4000);

  // Poll Public Config every 12 seconds for gateway & notice changes
  configPollInterval = setInterval(() => {
    if (!document.hidden) {
      loadConfig(true);
    }
  }, 12000);
}

// Immediate fetch on tab focus / visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadConfig(true);
    if (AppState.token) fetchUserProfile(true);
  }
});
window.addEventListener('focus', () => {
  loadConfig(true);
  if (AppState.token) fetchUserProfile(true);
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
          <button id="modal-btn-cancel" class="btn-activate-gold" style="flex:1; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-weight:800; font-size:0.95rem; border-radius:16px; display:none;">Cancel</button>
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
async function loadConfig(silent = false) {
  try {
    const res = await fetch(`${API}/config`);
    const data = await res.json();
    AppState.config = data;
    localStorage.setItem('star_config', JSON.stringify(data));
    if (data.plans && Array.isArray(data.plans)) {
      localStorage.setItem('star_plans', JSON.stringify(data.plans));
      renderPlans(data.plans);
    }
    if (data.settings) {
      renderNotice(data.settings.notice_text);
      renderGatewayDetails(data.settings);
    }
  } catch (err) {
    if (!silent) console.error("Config load error:", err);
  }
}

// Fetch Profile & Update State
async function fetchUserProfile(silent = false) {
  if (!AppState.token) return;
  try {
    const res = await fetch(`${API}/user/profile`, {
      headers: { 'Authorization': `Bearer ${AppState.token}` }
    });
    const data = await res.json();
    if (data.success) {
      AppState.user = data.user;
      AppState.activePlans = data.activePlans;
      localStorage.setItem('star_user', JSON.stringify(data.user));
      localStorage.setItem('star_active_plans', JSON.stringify(data.activePlans || []));
      localStorage.setItem('star_profile_cache', JSON.stringify(data));
      
      // Update team count UI
      const teamCountElem = document.getElementById('user-dyn-teamcount');
      if (teamCountElem) {
        teamCountElem.textContent = data.teamCount || '0';
      }

      // Render Referral Team List Table
      const teamTbody = document.getElementById('user-team-tbody');
      if (teamTbody) {
        if (data.teamList && data.teamList.length > 0) {
          const newTeamHtml = data.teamList.map(member => {
            const date = new Date(member.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
            const initial = (member.username || 'U').slice(0, 2).toUpperCase();
            return `
              <tr style="border-bottom: 1px solid #fef3c7; transition: background 0.2s ease;">
                <td style="padding: 0.85rem 0.75rem; text-align: left;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 32px; height: 32px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; color: var(--primary-gold); font-weight: 800; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                      ${initial}
                    </div>
                    <div>
                      <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-dark);">${member.username}</div>
                      <span style="font-size: 0.65rem; font-weight: 800; color: var(--emerald-green); background: #d1fae5; padding: 1px 6px; border-radius: 8px;">Direct Member</span>
                    </div>
                  </div>
                </td>
                <td style="padding: 0.85rem 0.75rem; text-align: left;">
                  <code style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.2rem 0.5rem; border-radius: 8px; font-size: 0.8rem; color: #334155; font-weight: 700;">${member.phone}</code>
                </td>
                <td style="padding: 0.85rem 0.75rem; text-align: left; font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
                  📅 ${date}
                </td>
              </tr>
            `;
          }).join('');
          if (teamTbody.innerHTML !== newTeamHtml) {
            teamTbody.innerHTML = newTeamHtml;
          }
        } else {
          teamTbody.innerHTML = `
            <tr>
              <td colspan="3" style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                No referrals yet. Share your link to start building your team!
              </td>
            </tr>
          `;
        }
      }

      // Render User Records Tables on records.html
      renderUserRecords(data);

      updateClientUI();
    }
  } catch (err) {
    if (!silent) console.error("Profile sync error:", err);
  }
}

// Render User Transaction Records on records.html
function renderUserRecords(data) {
  const depTbody = document.getElementById('user-rec-deposits');
  if (depTbody) {
    const deposits = data.deposits || [];
    if (deposits.length > 0) {
      depTbody.innerHTML = deposits.map(d => {
        const date = new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const ref = d.depositRef || d.deposit_ref || 'DEP';
        return `
          <tr style="border-bottom: 1px solid #fef3c7;">
            <td style="padding:0.85rem 0.75rem;"><code style="background:#f8fafc; border:1px solid #cbd5e1; padding:0.2rem 0.4rem; border-radius:6px; font-weight:700; color:#334155; font-size:0.75rem;">${ref}</code></td>
            <td style="padding:0.85rem 0.75rem;"><strong style="color:var(--emerald-green); font-size:0.85rem;">PKR ${Number(d.amount).toLocaleString()}</strong></td>
            <td style="padding:0.85rem 0.75rem; font-size:0.8rem; font-weight:700; color:#475569;">${d.gateway}</td>
            <td style="padding:0.85rem 0.75rem;"><span class="status-badge status-${d.status}">${d.status}</span></td>
            <td style="padding:0.85rem 0.75rem; font-size:0.8rem; color:var(--text-muted);">📅 ${date}</td>
          </tr>
        `;
      }).join('');
    } else {
      depTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">No deposit history found.</td></tr>';
    }
  }

  const witTbody = document.getElementById('user-rec-withdrawals');
  if (witTbody) {
    const withdrawals = data.withdrawals || [];
    if (withdrawals.length > 0) {
      witTbody.innerHTML = withdrawals.map(w => {
        const date = new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const ref = w.withdrawalRef || w.withdrawal_ref || 'WIT';
        const title = w.accountTitle || w.account_title || '';
        const num = w.accountNumber || w.account_number || '';
        const reasonStr = w.reason ? `<br><small style="color:#ef4444; font-size:0.7rem; font-weight:700;">Reason: ${w.reason}</small>` : '';
        return `
          <tr style="border-bottom: 1px solid #fef3c7;">
            <td style="padding:0.85rem 0.75rem;"><code style="background:#f8fafc; border:1px solid #cbd5e1; padding:0.2rem 0.4rem; border-radius:6px; font-weight:700; color:#334155; font-size:0.75rem;">${ref}</code></td>
            <td style="padding:0.85rem 0.75rem;"><strong style="color:var(--primary-gold); font-size:0.85rem;">PKR ${Number(w.amount).toLocaleString()}</strong></td>
            <td style="padding:0.85rem 0.75rem; font-size:0.8rem; color:#334155;"><span style="font-weight:700;">${title}</span><br><code style="font-size:0.75rem; background:#f1f5f9; padding:1px 4px; border-radius:4px;">${num}</code></td>
            <td style="padding:0.85rem 0.75rem;"><span class="status-badge status-${w.status}">${w.status}</span>${reasonStr}</td>
            <td style="padding:0.85rem 0.75rem; font-size:0.8rem; color:var(--text-muted);">📅 ${date}</td>
          </tr>
        `;
      }).join('');
    } else {
      witTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">No withdrawal history found.</td></tr>';
    }
  }

  const minTbody = document.getElementById('user-rec-mining');
  if (minTbody) {
    const allPlans = data.allPlans || data.activePlans || [];
    if (allPlans.length > 0) {
      minTbody.innerHTML = allPlans.map(p => {
        const name = p.planName || p.plan_name || 'VIP Plan';
        const price = Number(p.investment || p.price || 0);
        const dailyProfit = Number(p.dailyProfit || p.daily_profit || 0);
        const claimsCount = Number(p.claimsCount || p.claims_count || 0);
        const validityDays = Number(p.validityDays || p.validity_days || 12);
        const status = p.status || 'Active';
        return `
          <tr style="border-bottom: 1px solid #fef3c7;">
            <td style="padding:0.85rem 0.75rem; font-weight:800; color:var(--text-dark); font-size:0.85rem;">⭐ ${name}</td>
            <td style="padding:0.85rem 0.75rem; font-weight:700; color:var(--primary-gold); font-size:0.85rem;">PKR ${price.toLocaleString()}</td>
            <td style="padding:0.85rem 0.75rem; font-weight:700; color:var(--emerald-green); font-size:0.85rem;">PKR ${dailyProfit.toLocaleString()}</td>
            <td style="padding:0.85rem 0.75rem; font-size:0.8rem; font-weight:700; color:#475569;">${claimsCount} / ${validityDays} Days</td>
            <td style="padding:0.85rem 0.75rem;"><span class="status-badge status-${status}">${status}</span></td>
          </tr>
        `;
      }).join('');
    } else {
      minTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">No mining plans history found.</td></tr>';
    }
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
  const containers = document.querySelectorAll('#vip-plans-list, #plans-container, .plans-container, .plans-grid');
  if (!containers || containers.length === 0 || !plans || plans.length === 0) return;

  const html = plans.map(p => {
    const planId = p._id || p.id;
    const validityDays = p.validity_days || p.validityDays || 12;
    const dailyProfit = p.daily_profit || p.dailyProfit || 0;
    const totalProfit = p.total_profit || p.totalProfit || (dailyProfit * validityDays);
    const level1Bonus = p.level1_bonus || p.level1Bonus || Math.round(p.price * 0.10);
    const level2Bonus = p.level2_bonus || p.level2Bonus || Math.round(p.price * 0.05);

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
          <div style="font-size:1.25rem; font-weight:800; color:var(--text-dark); margin-top:0.2rem;">PKR ${dailyProfit.toLocaleString()}</div>
        </div>
        <div style="background:#f4f8f6; border:1px solid #e2e8f0; border-radius:16px; padding:0.85rem 1rem;">
          <span style="font-size:0.7rem; font-weight:800; color:var(--cyan-neon); display:flex; align-items:center; gap:0.3rem;">👛 TOTAL</span>
          <div style="font-size:1.25rem; font-weight:800; color:var(--text-dark); margin-top:0.2rem;">PKR ${totalProfit.toLocaleString()}</div>
        </div>
      </div>

      <!-- 2-Tier Referral Commission Box -->
      <div style="background:#f4f8f6; border:1px solid #e2e8f0; border-radius:18px; padding:1rem; margin-bottom:1.25rem;">
        <span style="font-size:0.8rem; font-weight:800; color:var(--primary-teal); display:block; margin-bottom:0.75rem;">👥 Referral Commission · Daily Mining</span>
        
        <div style="background:#ffffff; border-radius:12px; padding:0.6rem 0.85rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; font-size:0.8rem; color:var(--text-muted); font-weight:600;">
          <span>Level 1</span>
          <div>
            <span style="color:var(--emerald-green); font-weight:800; margin-right:0.4rem;">10%</span>
            <strong style="color:var(--primary-gold);">PKR ${level1Bonus}</strong>
          </div>
        </div>

        <div style="background:#ffffff; border-radius:12px; padding:0.6rem 0.85rem; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted); font-weight:600;">
          <span>Level 2</span>
          <div>
            <span style="color:var(--cyan-neon); font-weight:800; margin-right:0.4rem;">5%</span>
            <strong style="color:var(--primary-gold);">PKR ${level2Bonus}</strong>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <button onclick="activatePlan('${planId}', '${p.name}', ${p.price})" class="btn-activate-gold">
        👑 Activate Plan
      </button>

    </div>
    `;
  }).join('');

  containers.forEach(container => {
    container.innerHTML = html;
  });
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

  // Render Dynamic WhatsApp Support Links across entire app
  if (s) {
    const rawNum = s.whatsapp_number || s.whatsappNumber || '03438275273';
    let cleanNum = String(rawNum).replace(/[^0-9]/g, '');
    if (cleanNum.startsWith('0')) {
      cleanNum = '92' + cleanNum.slice(1);
    }
    const waUrl = `https://wa.me/${cleanNum}`;

    const waLinks = document.querySelectorAll('a.whatsapp-link, a.whatsapp-float, a[href*="wa.me"]');
    waLinks.forEach(link => {
      link.href = waUrl;
    });
  }
}

// Update UI
function updateClientUI() {
  const u = AppState.user;

  // Render cached plans if available
  const cachedPlans = localStorage.getItem('star_plans');
  if (cachedPlans) {
    try {
      renderPlans(JSON.parse(cachedPlans));
    } catch(e) {}
  }

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

let miningTimerInterval = null;

// Render Active Mining Cards with Live 24h Countdown & Disabled State
function renderMiningCards() {
  const container = document.getElementById('mining-cards-container');
  if (!container) return;

  const cachedActivePlans = localStorage.getItem('star_active_plans');
  let activePlans = AppState.activePlans;
  if ((!activePlans || activePlans.length === 0) && cachedActivePlans) {
    try {
      activePlans = JSON.parse(cachedActivePlans);
    } catch(e) {}
  }

  if (!activePlans || activePlans.length === 0) {
    if (miningTimerInterval) {
      clearInterval(miningTimerInterval);
      miningTimerInterval = null;
    }
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

  const now = new Date();

  container.innerHTML = activePlans.map(plan => {
    const userPlanId = plan._id || plan.id;
    const planName = plan.planName || plan.plan_name || 'VIP Package';
    const investment = Number(plan.investment || 0);
    const dailyProfit = Number(plan.dailyProfit || plan.daily_profit || 0);
    const claimsCount = Number(plan.claimsCount || plan.claims_count || 0);
    const validityDays = Number(plan.validityDays || plan.validity_days || 12);
    const lastClaimStr = plan.lastClaim || plan.last_claim || plan.createdAt;

    const lastClaimDate = lastClaimStr ? new Date(lastClaimStr) : new Date(0);
    const nextClaimDate = new Date(lastClaimDate.getTime() + 24 * 60 * 60 * 1000);
    const diffMs = nextClaimDate.getTime() - now.getTime();

    let buttonHtml = '';
    if (diffMs > 0 && claimsCount > 0) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      buttonHtml = `
        <button disabled class="btn-activate-gold" style="background:#e2e8f0; color:#64748b; border:1px solid #cbd5e1; width:100%; margin-top:0; cursor:not-allowed; opacity:0.9;" data-claim-target="${nextClaimDate.getTime()}">
          ⏳ Next Claim in ${hours}h ${minutes}m ${seconds}s
        </button>
      `;
    } else {
      buttonHtml = `
        <button onclick="claimDailyProfit('${userPlanId}')" class="btn-activate-gold" style="background:var(--emerald-gradient); color:#ffffff; width:100%; margin-top:0;">
          ⚡ Claim Daily Output (PKR ${dailyProfit.toLocaleString()})
        </button>
      `;
    }

    return `
    <div class="vip-card" style="text-align:left; margin-bottom:1.25rem;">
      <div class="vip-card-header">
        <div>
          <h3 style="font-size:1.1rem; color:var(--text-dark); margin:0;">${planName} Mining Rig ⚡</h3>
          <span style="font-size:0.75rem; color:var(--emerald-green); font-weight:700;">🟢 Active Mining (${claimsCount}/${validityDays} Days Claimed)</span>
        </div>
        <span class="vip-badge-pill" style="background:var(--emerald-gradient);">ACTIVE</span>
      </div>
      <div class="vip-stats-grid">
        <div class="vip-stat-box">
          <span style="font-size:0.7rem; font-weight:800; color:var(--primary-gold);">INVESTED</span>
          <div style="font-size:1.1rem; font-weight:800; color:var(--text-dark);">PKR ${investment.toLocaleString()}</div>
        </div>
        <div class="vip-stat-box">
          <span style="font-size:0.7rem; font-weight:800; color:var(--emerald-green);">DAILY RETURN</span>
          <div style="font-size:1.1rem; font-weight:800; color:var(--text-dark);">PKR ${dailyProfit.toLocaleString()}</div>
        </div>
      </div>
      ${buttonHtml}
    </div>
    `;
  }).join('');

  startMiningTimers();
}

// Live 1-Second Countdown Timer Updater for Active Mining Cards
function startMiningTimers() {
  if (miningTimerInterval) clearInterval(miningTimerInterval);

  miningTimerInterval = setInterval(() => {
    const timerBtns = document.querySelectorAll('button[data-claim-target]');
    if (!timerBtns || timerBtns.length === 0) {
      clearInterval(miningTimerInterval);
      miningTimerInterval = null;
      return;
    }

    const nowTime = new Date().getTime();
    let hasExpiredTimer = false;

    timerBtns.forEach(btn => {
      const targetTime = Number(btn.getAttribute('data-claim-target'));
      const diffMs = targetTime - nowTime;

      if (diffMs <= 0) {
        hasExpiredTimer = true;
      } else {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        btn.innerHTML = `⏳ Next Claim in ${hours}h ${minutes}m ${seconds}s`;
      }
    });

    if (hasExpiredTimer) {
      clearInterval(miningTimerInterval);
      miningTimerInterval = null;
      if (AppState.token) {
        fetchUserProfile();
      }
    }
  }, 1000);
}

// Claim Daily Profit Action
async function claimDailyProfit(userPlanId) {
  if (!AppState.user) return showToast('Please login first', 'error');
  const userId = AppState.user.id || AppState.user._id;

  try {
    const res = await fetch(`${API}/claim-daily-profit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userPlanId })
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
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;
  const otp = document.getElementById('reg-otp').value;
  const ref = document.getElementById('reg-ref').value;

  setButtonLoading(submitBtn, true, 'Creating Account...');

  try {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, phone, password, otp, ref })
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
  localStorage.removeItem('star_active_plans');
  localStorage.removeItem('star_profile_cache');
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

// Live Deposit Screenshot Preview Handler
function handleScreenshotPreview(event) {
  const file = event.target.files[0];
  const placeholder = document.getElementById('dep-screenshot-placeholder');
  const previewBox = document.getElementById('dep-screenshot-preview-box');
  const fileNameElem = document.getElementById('dep-screenshot-filename');
  const imgPreview = document.getElementById('dep-screenshot-img-preview');
  const dropzone = document.getElementById('dep-screenshot-dropzone');

  if (file && previewBox && placeholder) {
    fileNameElem.textContent = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
      imgPreview.src = e.target.result;
      placeholder.style.display = 'none';
      previewBox.style.display = 'block';
      if (dropzone) {
        dropzone.style.background = '#f0fdf4';
        dropzone.style.borderColor = '#10b981';
      }
    };
    reader.readAsDataURL(file);
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

  if (!fileInput || !fileInput.files[0]) {
    return showCustomModal('Screenshot Required', 'Please upload payment receipt screenshot proof before submitting deposit request.', 'error');
  }

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

  const userId = AppState.user.id || AppState.user._id;

  try {
    const res = await fetch(`${API}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        amount,
        gateway,
        tid,
        screenshotData
      })
    });
    const data = await res.json();
    setButtonLoading(submitBtn, false);
    if (data.success) {
      showCustomModal('Deposit Request Submitted', data.message, 'success', () => {
        window.location.href = '/dashboard.html';
      });
    } else {
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

  const userId = AppState.user.id || AppState.user._id;

  try {
    const res = await fetch(`${API}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        amount,
        gateway,
        accountTitle,
        accountNumber,
        bankName
      })
    });
    const data = await res.json();
    setButtonLoading(submitBtn, false);
    if (data.success) {
      showCustomModal('Withdrawal Submitted', data.message, 'success', async () => {
        await fetchUserProfile();
        window.location.href = '/dashboard.html';
      });
    } else {
      showCustomModal('Withdrawal Failed', data.message, 'error');
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showToast('Failed to submit withdrawal.', 'error');
  }
}

// Activate Plan Action with Modal Confirmation / Smooth Deposit Redirect
function activatePlan(planId, planName, planPrice) {
  if (!AppState.user) return showToast('Please login first', 'error');

  const currentBalance = Number(AppState.user.balance || 0);

  // If insufficient balance, smoothly redirect/scroll to deposit section instead of showing error
  if (currentBalance < planPrice) {
    const depAmountElem = document.getElementById('dep-amount');
    showToast(`Please deposit PKR ${planPrice.toLocaleString()} to activate ${planName}.`, 'info');
    if (depAmountElem) {
      depAmountElem.value = planPrice;
      depAmountElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      depAmountElem.focus();
    } else {
      window.location.href = `/deposit.html?amount=${planPrice}`;
    }
    return;
  }

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
          setTimeout(() => window.location.href = '/mining.html', 1000);
        } else {
          // If server responds with insufficient balance, direct to deposit
          if (data.message && data.message.toLowerCase().includes('balance')) {
            showToast(data.message, 'info');
            const depAmountElem = document.getElementById('dep-amount');
            if (depAmountElem) {
              depAmountElem.value = planPrice;
              depAmountElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
              depAmountElem.focus();
            } else {
              window.location.href = `/deposit.html?amount=${planPrice}`;
            }
          } else {
            showCustomModal('Subscription Error', data.message, 'error');
          }
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

let otpCountdownTimer = null;

function resetOtpSendButton() {
  const btn = document.getElementById('btn-send-otp');
  if (btn) {
    if (otpCountdownTimer) {
      clearInterval(otpCountdownTimer);
      otpCountdownTimer = null;
    }
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    btn.innerHTML = 'Send OTP';
  }
}

// Attach Email Input Listener to enable instant re-sending on email edit/typo fix
document.addEventListener('DOMContentLoaded', () => {
  const regEmail = document.getElementById('reg-email');
  if (regEmail) {
    regEmail.addEventListener('input', resetOtpSendButton);
  }
  const forgotEmail = document.getElementById('forgot-email');
  if (forgotEmail) {
    forgotEmail.addEventListener('input', resetOtpSendButton);
  }
});

// Send Registration OTP
async function sendRegisterOtp(e) {
  if (e) e.preventDefault();
  const emailElem = document.getElementById('reg-email');
  if (!emailElem || !emailElem.value) {
    return showToast('Please enter your email address first', 'error');
  }
  
  const btn = document.getElementById('btn-send-otp');
  setButtonLoading(btn, true, 'Sending...');

  try {
    const res = await fetch(`${API}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailElem.value.trim().toLowerCase(), type: 'signup' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      let count = 60;
      btn.disabled = true;
      if (otpCountdownTimer) clearInterval(otpCountdownTimer);
      otpCountdownTimer = setInterval(() => {
        if (count <= 0) {
          clearInterval(otpCountdownTimer);
          otpCountdownTimer = null;
          btn.disabled = false;
          btn.innerHTML = 'Send OTP';
        } else {
          btn.innerHTML = `Resend (${count}s)`;
          count--;
        }
      }, 1000);
    } else {
      setButtonLoading(btn, false);
      showCustomModal('OTP Error', data.message, 'error');
    }
  } catch (err) {
    setButtonLoading(btn, false);
    showToast('Failed to send OTP. Try again.', 'error');
  }
}

// Send Forgot Password OTP
async function sendForgotOtp(e) {
  if (e) e.preventDefault();
  const emailElem = document.getElementById('forgot-email');
  if (!emailElem || !emailElem.value) {
    return showToast('Please enter your email address first', 'error');
  }
  
  const btn = document.getElementById('btn-send-otp');
  setButtonLoading(btn, true, 'Sending...');

  try {
    const res = await fetch(`${API}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailElem.value.trim().toLowerCase(), type: 'forgot' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      let count = 60;
      btn.disabled = true;
      if (otpCountdownTimer) clearInterval(otpCountdownTimer);
      otpCountdownTimer = setInterval(() => {
        if (count <= 0) {
          clearInterval(otpCountdownTimer);
          otpCountdownTimer = null;
          btn.disabled = false;
          btn.innerHTML = 'Send OTP';
        } else {
          btn.innerHTML = `Resend (${count}s)`;
          count--;
        }
      }, 1000);
    } else {
      setButtonLoading(btn, false);
      showCustomModal('OTP Error', data.message, 'error');
    }
  } catch (err) {
    setButtonLoading(btn, false);
    showToast('Failed to send OTP. Try again.', 'error');
  }
}

// Reset Password Form Handler
async function handleForgotPassword(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const email = document.getElementById('forgot-email').value;
  const otp = document.getElementById('forgot-otp').value;
  const newPassword = document.getElementById('forgot-new-password').value;

  setButtonLoading(submitBtn, true, 'Resetting Password...');

  try {
    const res = await fetch(`${API}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1500);
    } else {
      setButtonLoading(submitBtn, false);
      showCustomModal('Reset Failed', data.message, 'error');
    }
  } catch (err) {
    setButtonLoading(submitBtn, false);
    showToast('Server connection error', 'error');
  }
}

// Show/Hide Password Toggle
function togglePasswordVisibility(inputFieldId, element) {
  const input = document.getElementById(inputFieldId);
  if (input) {
    if (input.type === 'password') {
      input.type = 'text';
      element.textContent = '🙈';
    } else {
      input.type = 'password';
      element.textContent = '👁️';
    }
  }
}

// Native Mobile Pull-to-Refresh System
function setupPullToRefresh() {
  if (document.getElementById('pull-to-refresh-indicator')) return;

  const indicator = document.createElement('div');
  indicator.id = 'pull-to-refresh-indicator';
  indicator.className = 'ptr-indicator';
  indicator.innerHTML = `
    <div class="ptr-content">
      <span id="ptr-icon" class="ptr-icon">⬇️</span>
      <span id="ptr-text" class="ptr-text">Pull down to refresh</span>
    </div>
  `;
  document.body.appendChild(indicator);

  const ptrIcon = document.getElementById('ptr-icon');
  const ptrText = document.getElementById('ptr-text');

  let startY = 0;
  let currentY = 0;
  let isPulling = false;
  let isRefreshing = false;
  const threshold = 60;

  window.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 0 && !isRefreshing) {
      startY = e.touches[0].clientY;
      isPulling = true;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isPulling || isRefreshing) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    if (diff > 0 && window.scrollY <= 0) {
      const pullHeight = Math.min(diff * 0.45, 75);
      indicator.style.height = `${pullHeight}px`;
      indicator.style.opacity = `${pullHeight / 75}`;

      if (pullHeight >= threshold) {
        ptrIcon.textContent = '🔄';
        ptrIcon.classList.remove('spinning');
        ptrText.textContent = 'Release to refresh';
      } else {
        ptrIcon.textContent = '⬇️';
        ptrIcon.classList.remove('spinning');
        ptrText.textContent = 'Pull down to refresh';
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', async () => {
    if (!isPulling || isRefreshing) return;
    isPulling = false;

    const currentHeight = parseFloat(indicator.style.height || '0');
    if (currentHeight >= threshold) {
      isRefreshing = true;
      indicator.style.height = '60px';
      indicator.style.opacity = '1';
      ptrIcon.textContent = '🔄';
      ptrIcon.classList.add('spinning');
      ptrText.textContent = 'Refreshing data...';

      try {
        await loadConfig();
        if (AppState.token) {
          await fetchUserProfile();
        }
        showToast('App refreshed successfully!', 'success');
      } catch (err) {
        console.error('Pull to refresh error:', err);
      }

      setTimeout(() => {
        indicator.style.height = '0px';
        indicator.style.opacity = '0';
        ptrIcon.classList.remove('spinning');
        isRefreshing = false;
      }, 500);
    } else {
      indicator.style.height = '0px';
      indicator.style.opacity = '0';
    }
  });
}
