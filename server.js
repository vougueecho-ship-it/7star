require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret7starjwtkey987654321';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin@7starinvest';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '7starsecretadmin2026';

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static file hosting
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// Database Connection
const db = new Database(path.join(__dirname, 'database.db'));
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT,
    google_id TEXT,
    avatar TEXT,
    balance REAL DEFAULT 0,
    total_deposit REAL DEFAULT 0,
    total_withdraw REAL DEFAULT 0,
    total_profit REAL DEFAULT 0,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by TEXT,
    has_credited_referral_bonus INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { db.exec("ALTER TABLE users ADD COLUMN has_credited_referral_bonus INTEGER DEFAULT 0;"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN google_id TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN email TEXT;"); } catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    daily_profit REAL NOT NULL,
    total_profit REAL NOT NULL,
    validity_days INTEGER DEFAULT 12,
    level1_bonus REAL NOT NULL,
    level2_bonus REAL NOT NULL,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    plan_name TEXT NOT NULL,
    investment REAL NOT NULL,
    daily_profit REAL NOT NULL,
    total_profit REAL NOT NULL,
    validity_days INTEGER DEFAULT 12,
    claims_count INTEGER DEFAULT 0,
    last_claim DATETIME,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deposit_ref TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    phone TEXT NOT NULL,
    amount REAL NOT NULL,
    gateway TEXT NOT NULL,
    tid TEXT NOT NULL,
    screenshot TEXT,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    withdrawal_ref TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    phone TEXT NOT NULL,
    amount REAL NOT NULL,
    gateway TEXT NOT NULL,
    account_title TEXT NOT NULL,
    account_number TEXT NOT NULL,
    bank_name TEXT,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Update site name and settings to 7 STAR INVEST
const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
insertSetting.run('site_name', '7 STAR INVEST');
insertSetting.run('notice_text', '🌟 Welcome to 7 STAR INVEST - Halal & Trusted Earning Platform 💯 | Daily Returns Credited Automatically!');
insertSetting.run('easypaisa_title', 'Muhammad ikaram');
insertSetting.run('easypaisa_number', '03438275273');
insertSetting.run('whatsapp_number', '03438275273');
insertSetting.run('min_withdraw', '100');
insertSetting.run('max_withdraw', '500000');

function getSettingsMap() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = {};
  rows.forEach(r => map[r.key] = r.value);
  return map;
}

// Helper: Sanitize Referral Code
function sanitizeRef(ref) {
  if (!ref) return null;
  const str = String(ref).trim();
  if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null' || str.toLowerCase() === 'none' || str.toLowerCase() === 'false' || str === '0') {
    return null;
  }
  return str.toUpperCase();
}

// Automatic cleanup of legacy invalid 'undefined' or 'null' referred_by values
try {
  db.exec("UPDATE users SET referred_by = NULL WHERE LOWER(referred_by) IN ('undefined', 'null', 'none', 'false', '');");
} catch(e) {}

// REST API Endpoints

// Public Config
app.get('/api/config', (req, res) => {
  const settings = getSettingsMap();
  const plans = db.prepare('SELECT * FROM plans WHERE active = 1 ORDER BY price ASC').all();
  res.json({ settings, plans });
});

// User Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, phone, password, ref } = req.body;
    if (!username || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR phone = ?').get(username, phone);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username or phone number already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const referralCode = 'STAR' + Math.floor(10000 + Math.random() * 90000);
    const cleanRef = sanitizeRef(ref);

    const stmt = db.prepare(`
      INSERT INTO users (username, phone, password_hash, referral_code, referred_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, phone, passwordHash, referralCode, cleanRef);

    const newUser = db.prepare('SELECT id, username, phone, balance, total_deposit, total_withdraw, total_profit, referral_code FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ success: true, message: 'Account registered successfully!', token, user: newUser });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanInput = String(username || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanInput || !cleanPassword) {
      return res.status(400).json({ success: false, message: 'Please enter username, email or phone and password' });
    }

    const cleanInputLower = cleanInput.toLowerCase();
    const digitsOnly = cleanInput.replace(/[^0-9]/g, '');

    const user = db.prepare(`
      SELECT * FROM users
      WHERE LOWER(username) = ? OR LOWER(email) = ? OR phone = ? OR (length(?) >= 7 AND phone LIKE ?)
    `).get(cleanInputLower, cleanInputLower, cleanInput, digitsOnly, '%' + digitsOnly.slice(-10));

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username, email, phone, or password' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ success: false, message: 'Invalid username, email, phone, or password' });
    }

    const isValid = await bcrypt.compare(cleanPassword, user.password_hash);
    if (!isValid) {
      if (user.google_id && user.password_hash.startsWith('google_auth_user')) {
        return res.status(401).json({
          success: false,
          message: 'This account was created with Google. Please click "Continue with Google" to log in, or reset password.'
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid username, email, phone, or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    delete user.password_hash;

    res.json({ success: true, message: 'Login successful!', token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// Google Authentication Route
app.post('/api/auth/google', async (req, res) => {
  try {
    const { googleId, email, name, picture, credential, refCode } = req.body;
    let targetEmail = email;
    let targetGoogleId = googleId;
    let targetName = name;
    let targetPicture = picture;

    if (credential && (!targetEmail || !targetGoogleId)) {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(Buffer.from(base64Url, 'base64').toString('utf-8'));
          targetEmail = payload.email || targetEmail;
          targetGoogleId = payload.sub || targetGoogleId;
          targetName = payload.name || targetName;
          targetPicture = payload.picture || targetPicture;
        }
      } catch (e) {
        console.error('Base64url JWT parse error in server.js:', e);
      }
    }

    if (!targetEmail && !targetGoogleId) {
      return res.status(400).json({ success: false, message: 'Unable to extract Google account email' });
    }

    let user = null;
    if (targetGoogleId) {
      user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(targetGoogleId);
    }
    if (!user && targetEmail) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(targetEmail);
    }

    if (!user) {
      let baseUsername = (targetName || targetEmail.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (baseUsername.length < 3) baseUsername = 'user';
      let username = baseUsername;
      let counter = 1;
      while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
        username = `${baseUsername}${Math.floor(100 + Math.random() * 900)}${counter}`;
        counter++;
      }

      const referralCode = 'STAR' + Math.floor(100000 + Math.random() * 900000);
      const cleanRef = sanitizeRef(refCode);

      const stmt = db.prepare(`
        INSERT INTO users (username, email, phone, password_hash, google_id, avatar, referral_code, referred_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(username, targetEmail, '', 'google_auth_user', targetGoogleId, targetPicture, referralCode, cleanRef);
      user = db.prepare('SELECT id, username, email, phone, avatar, balance, total_deposit, total_withdraw, total_profit, referral_code FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      delete user.password_hash;
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, message: 'Google login successful!', token, user });
  } catch (err) {
    console.error("Google auth server error:", err);
    res.status(500).json({ success: false, message: 'Server error during Google auth' });
  }
});

// Get User Profile
app.get('/api/user/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const targetId = decoded.id || decoded.userId;
    const user = db.prepare('SELECT id, username, phone, balance, total_deposit, total_withdraw, total_profit, referral_code, created_at FROM users WHERE id = ?').get(targetId);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const activePlans = db.prepare("SELECT * FROM user_plans WHERE user_id = ? AND status = 'Active'").all(user.id);
    const teamCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE LOWER(referred_by) = LOWER(?)').get(user.referral_code).count;
    const teamList = db.prepare('SELECT username, phone, balance, created_at as createdAt FROM users WHERE LOWER(referred_by) = LOWER(?) ORDER BY created_at DESC').all(user.referral_code);

    res.json({ success: true, user, activePlans, teamCount, teamList });
  } catch (err) {
    console.error("Profile API Error:", err);
    res.status(401).json({ success: false, message: 'Session expired' });
  }
});

// Update User Profile (Phone)
app.post('/api/user/update-profile', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const targetId = decoded.id || decoded.userId;

    const { phone } = req.body;
    if (!phone || phone.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid mobile number' });
    }

    const cleanPhone = phone.trim();
    const existing = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(cleanPhone, targetId);
    if (existing) {
      return res.status(400).json({ success: false, message: 'This mobile number is already registered to another account' });
    }

    db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(cleanPhone, targetId);
    const updatedUser = db.prepare('SELECT id, username, phone, balance, total_deposit, total_withdraw, total_profit, referral_code, created_at FROM users WHERE id = ?').get(targetId);

    res.json({ success: true, message: 'Mobile number updated successfully!', user: updatedUser });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

// Submit Deposit
app.post('/api/deposit', (req, res) => {
  const { userId, amount, gateway, tid, screenshotData } = req.body;
  if (!userId || !amount || !gateway || !tid) {
    return res.status(400).json({ success: false, message: 'Please fill all deposit details' });
  }

  const user = db.prepare('SELECT id, username, phone FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  let screenshotPath = null;
  if (screenshotData && screenshotData.startsWith('data:image')) {
    const base64Data = screenshotData.replace(/^data:image\/\w+;base64,/, "");
    const fileName = `dep_${Date.now()}_${Math.floor(Math.random()*1000)}.png`;
    fs.writeFileSync(path.join(__dirname, 'uploads', fileName), base64Data, 'base64');
    screenshotPath = `/uploads/${fileName}`;
  }

  const depositRef = 'DEP' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90);
  db.prepare(`
    INSERT INTO deposits (deposit_ref, user_id, username, phone, amount, gateway, tid, screenshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(depositRef, user.id, user.username, user.phone, Number(amount), gateway, tid, screenshotPath);

  res.json({ success: true, message: 'Deposit request submitted successfully! Waiting for Admin verification.' });
});

// Submit Withdrawal
app.post('/api/withdraw', (req, res) => {
  const { userId, amount, gateway, accountTitle, accountNumber, bankName } = req.body;
  if (!userId || !amount || !gateway || !accountTitle || !accountNumber) {
    return res.status(400).json({ success: false, message: 'Please fill all withdrawal details' });
  }

  const user = db.prepare('SELECT id, username, phone, balance, total_profit FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const numAmount = Number(amount);
  if (user.balance < numAmount) {
    return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
  }

  const withdrawableProfit = user.total_profit || 0;
  if (withdrawableProfit <= 0 || numAmount > withdrawableProfit) {
    return res.status(400).json({
      success: false,
      message: `Withdrawal limit exceeded! Invested capital is locked in active plans. You can only withdraw earned daily mining profits & referral bonuses (Available Withdrawable Profit: PKR ${withdrawableProfit.toLocaleString()}).`
    });
  }

  db.prepare('UPDATE users SET balance = balance - ?, total_profit = MAX(0, total_profit - ?) WHERE id = ?').run(numAmount, numAmount, user.id);

  const withdrawalRef = 'WIT' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90);
  db.prepare(`
    INSERT INTO withdrawals (withdrawal_ref, user_id, username, phone, amount, gateway, account_title, account_number, bank_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(withdrawalRef, user.id, user.username, user.phone, numAmount, gateway, accountTitle, accountNumber, bankName || null);

  res.json({ success: true, message: 'Withdrawal request submitted! Payout will be sent shortly.' });
});

// Activate VIP Plan
app.post('/api/activate-plan', (req, res) => {
  const { userId, planId } = req.body;
  const user = db.prepare('SELECT id, balance, username, referred_by FROM users WHERE id = ?').get(userId);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);

  if (!user || !plan) return res.status(400).json({ success: false, message: 'Invalid plan or user' });

  if (user.balance < plan.price) {
    return res.status(400).json({ success: false, message: `Insufficient balance. ${plan.name} costs PKR ${plan.price}. Please deposit first.` });
  }

  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(plan.price, user.id);

  db.prepare(`
    INSERT INTO user_plans (user_id, plan_id, plan_name, investment, daily_profit, total_profit, last_claim)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(user.id, plan.id, plan.name, plan.price, plan.daily_profit, plan.total_profit);

  res.json({ success: true, message: `Successfully activated ${plan.name}! Daily mining starts now.` });
});

// Admin Auth Middleware
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Admin authentication required' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied: Admin privileges required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin session token' });
  }
}

// Claim Daily Profit Endpoint
app.post('/api/claim-daily-profit', (req, res) => {
  const { userId, userPlanId } = req.body;
  if (!userId || !userPlanId) {
    return res.status(400).json({ success: false, message: 'Missing user ID or plan ID' });
  }

  const userPlan = db.prepare("SELECT * FROM user_plans WHERE id = ? AND user_id = ? AND status = 'Active'").get(userPlanId, userId);
  if (!userPlan) {
    return res.status(404).json({ success: false, message: 'Active investment plan not found' });
  }

  const lastClaim = new Date(userPlan.last_claim || userPlan.created_at);
  const now = new Date();
  const diffHours = (now - lastClaim) / (1000 * 60 * 60);

  if (diffHours < 24) {
    const remainingHours = Math.ceil(24 - diffHours);
    return res.status(400).json({ success: false, message: `Mining output is compiling. Next claim available in ${remainingHours} hour(s).` });
  }

  const profitAmount = Number(userPlan.daily_profit);
  db.prepare('UPDATE users SET balance = balance + ?, total_profit = total_profit + ? WHERE id = ?').run(profitAmount, profitAmount, userId);
  db.prepare('UPDATE user_plans SET last_claim = CURRENT_TIMESTAMP WHERE id = ?').run(userPlanId);

  // Credit Level 1 & Level 2 Referral Daily Profit Share Bonuses (10% Direct & 2% Indirect)
  const claimingUser = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(userId);
  if (claimingUser && claimingUser.referred_by) {
    const cleanRefCode = claimingUser.referred_by.trim();
    const referrerL1 = db.prepare('SELECT id, referred_by FROM users WHERE LOWER(referral_code) = LOWER(?)').get(cleanRefCode);
    if (referrerL1) {
      const level1DailyBonus = Math.round(profitAmount * 0.10);
      if (level1DailyBonus > 0) {
        db.prepare('UPDATE users SET balance = balance + ?, total_profit = total_profit + ? WHERE id = ?').run(level1DailyBonus, level1DailyBonus, referrerL1.id);
      }
      if (referrerL1.referred_by) {
        const cleanL2RefCode = referrerL1.referred_by.trim();
        const referrerL2 = db.prepare('SELECT id FROM users WHERE LOWER(referral_code) = LOWER(?)').get(cleanL2RefCode);
        if (referrerL2) {
          const level2DailyBonus = Math.round(profitAmount * 0.02);
          if (level2DailyBonus > 0) {
            db.prepare('UPDATE users SET balance = balance + ?, total_profit = total_profit + ? WHERE id = ?').run(level2DailyBonus, level2DailyBonus, referrerL2.id);
          }
        }
      }
    }
  }

  res.json({ success: true, message: `Successfully claimed PKR ${profitAmount} daily mining profit!`, profit: profitAmount });
});

// Download APK Route
app.get('/download-apk', (req, res) => {
  const apkPath = path.join(__dirname, 'public', '7star-invest.apk');
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, '7star-invest-v1.0.apk');
  } else {
    res.redirect('/index.html?apk_status=ready');
  }
});

// Download Admin APK Route
app.get('/download-admin-apk', (req, res) => {
  const apkPath = path.join(__dirname, 'public', '7star-admin.apk');
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, '7star-admin-v1.0.apk');
  } else {
    const mainApkPath = path.join(__dirname, 'public', '7star-invest.apk');
    if (fs.existsSync(mainApkPath)) {
      res.download(mainApkPath, '7star-admin-v1.0.apk');
    } else {
      res.redirect('/xpro-admin/dashboard.html?apk_status=ready');
    }
  }
});

// Admin APIs
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ success: true, message: 'Admin authenticated!', token });
  }
  res.status(401).json({ success: false, message: 'Invalid Admin credentials' });
});

app.get('/api/admin/data', verifyAdminToken, (req, res) => {
  const users = db.prepare('SELECT id, username, phone, balance, total_deposit, total_withdraw, total_profit, referral_code, created_at FROM users ORDER BY id DESC').all();
  const deposits = db.prepare('SELECT * FROM deposits ORDER BY id DESC').all();
  const withdrawals = db.prepare('SELECT * FROM withdrawals ORDER BY id DESC').all();
  const plans = db.prepare('SELECT * FROM plans ORDER BY price ASC').all();
  const settings = getSettingsMap();

  res.json({ users, deposits, withdrawals, plans, settings });
});

app.post('/api/admin/deposit-status', verifyAdminToken, (req, res) => {
  const { depositId, status } = req.body;
  const deposit = db.prepare('SELECT id, deposit_ref, user_id, amount, phone, status FROM deposits WHERE id = ?').get(depositId);

  if (!deposit) return res.status(404).json({ success: false, message: 'Deposit not found' });

  const depAmount = Number(deposit.amount);
  if (isNaN(depAmount) || depAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid deposit amount' });
  }

  if (deposit.status === 'Pending' && status === 'Approved') {
    db.prepare('UPDATE deposits SET status = "Approved" WHERE id = ?').run(depositId);
    db.prepare('UPDATE users SET balance = balance + ?, total_deposit = total_deposit + ? WHERE id = ?').run(depAmount, depAmount, deposit.user_id);

    // Credit 1-Time Level 1 (10%) & Level 2 (2%) Referral Deposit Bonuses per player
    const depositingUser = db.prepare('SELECT referred_by, has_credited_referral_bonus FROM users WHERE id = ?').get(deposit.user_id);
    const cleanRefCode = sanitizeRef(depositingUser ? depositingUser.referred_by : null);

    if (depositingUser && !depositingUser.has_credited_referral_bonus && cleanRefCode) {
      const referrerL1 = db.prepare('SELECT id, referred_by FROM users WHERE LOWER(referral_code) = LOWER(?)').get(cleanRefCode);
      if (referrerL1) {
        const level1Bonus = Math.round(depAmount * 0.10);
        if (level1Bonus > 0) {
          db.prepare('UPDATE users SET balance = balance + ?, total_profit = total_profit + ? WHERE id = ?').run(level1Bonus, level1Bonus, referrerL1.id);
        }
        const cleanL2RefCode = sanitizeRef(referrerL1.referred_by);
        if (cleanL2RefCode) {
          const referrerL2 = db.prepare('SELECT id FROM users WHERE LOWER(referral_code) = LOWER(?)').get(cleanL2RefCode);
          if (referrerL2) {
            const level2Bonus = Math.round(depAmount * 0.02);
            if (level2Bonus > 0) {
              db.prepare('UPDATE users SET balance = balance + ?, total_profit = total_profit + ? WHERE id = ?').run(level2Bonus, level2Bonus, referrerL2.id);
            }
          }
        }
      }

      db.prepare('UPDATE users SET has_credited_referral_bonus = 1 WHERE id = ?').run(deposit.user_id);
    }
  } else if (status === 'Rejected') {
    db.prepare('UPDATE deposits SET status = "Rejected" WHERE id = ?').run(depositId);
  }

  res.json({ success: true, message: `Deposit ${status}!` });
});

app.post('/api/admin/withdrawal-status', verifyAdminToken, (req, res) => {
  const { withdrawalId, status } = req.body;
  const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId);

  if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

  if (withdrawal.status === 'Pending') {
    db.prepare('UPDATE withdrawals SET status = ? WHERE id = ?').run(status, withdrawalId);
    if (status === 'Approved') {
      db.prepare('UPDATE users SET total_withdraw = total_withdraw + ? WHERE id = ?').run(withdrawal.amount, withdrawal.user_id);
    } else if (status === 'Rejected') {
      db.prepare('UPDATE users SET balance = balance + ?, total_profit = total_profit + ? WHERE id = ?').run(withdrawal.amount, withdrawal.amount, withdrawal.user_id);
    }
  }

  res.json({ success: true, message: `Withdrawal ${status}!` });
});

app.post('/api/admin/settings-save', verifyAdminToken, (req, res) => {
  const { settings } = req.body;
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  Object.keys(settings).forEach(key => {
    stmt.run(key, settings[key]);
  });
  res.json({ success: true, message: 'Settings updated successfully!' });
});

app.post('/api/admin/edit-user-balance', verifyAdminToken, (req, res) => {
  const { userId, balance } = req.body;
  db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(Number(balance), userId);
  res.json({ success: true, message: 'User balance updated!' });
});

app.listen(PORT, () => {
  console.log(`🚀 7 STAR INVEST Production Server running on http://localhost:${PORT}`);
});

