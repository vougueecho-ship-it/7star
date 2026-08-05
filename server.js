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
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    balance REAL DEFAULT 0,
    total_deposit REAL DEFAULT 0,
    total_withdraw REAL DEFAULT 0,
    total_profit REAL DEFAULT 0,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

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

    const stmt = db.prepare(`
      INSERT INTO users (username, phone, password_hash, referral_code, referred_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, phone, passwordHash, referralCode, ref || null);

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
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please enter username and password' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? OR phone = ?').get(username, username);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    delete user.password_hash;

    res.json({ success: true, message: 'Login successful!', token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// Get User Profile
app.get('/api/user/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, phone, balance, total_deposit, total_withdraw, total_profit, referral_code, created_at FROM users WHERE id = ?').get(decoded.id);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const activePlans = db.prepare("SELECT * FROM user_plans WHERE user_id = ? AND status = 'Active'").all(user.id);
    const teamCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by = ?').get(user.referral_code).count;

    res.json({ success: true, user, activePlans, teamCount });
  } catch (err) {
    console.error("Profile API Error:", err);
    res.status(401).json({ success: false, message: 'Session expired' });
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

  // Credit Level 1 & 2 Bonuses
  if (user.referred_by) {
    const referrerL1 = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(user.referred_by);
    if (referrerL1) {
      db.prepare('UPDATE users SET balance = balance + ?, total_profit = total_profit + ? WHERE id = ?').run(plan.level1_bonus, plan.level1_bonus, referrerL1.id);
      
      const referrerL2Code = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(referrerL1.id);
      if (referrerL2Code && referrerL2Code.referred_by) {
        const referrerL2 = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referrerL2Code.referred_by);
        if (referrerL2) {
          db.prepare('UPDATE users SET balance = balance + ?, total_profit = total_profit + ? WHERE id = ?').run(plan.level2_bonus, plan.level2_bonus, referrerL2.id);
        }
      }
    }
  }

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
  const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(depositId);

  if (!deposit) return res.status(404).json({ success: false, message: 'Deposit not found' });

  if (deposit.status === 'Pending' && status === 'Approved') {
    db.prepare('UPDATE deposits SET status = "Approved" WHERE id = ?').run(depositId);
    db.prepare('UPDATE users SET balance = balance + ?, total_deposit = total_deposit + ? WHERE id = ?').run(deposit.amount, deposit.amount, deposit.user_id);
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
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(withdrawal.amount, withdrawal.user_id);
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

