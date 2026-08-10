import User from '@/models/User';

export function sanitizeReferralCode(ref: any): string | null {
  if (!ref) return null;
  const s = String(ref).trim();
  if (
    !s ||
    s.toLowerCase() === 'undefined' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'none' ||
    s.toLowerCase() === 'false' ||
    s === '0'
  ) {
    return null;
  }
  return s.toUpperCase();
}

export async function generateUniqueReferralCode(): Promise<string> {
  let isUnique = false;
  let code = '';
  let attempts = 0;
  while (!isUnique && attempts < 20) {
    attempts++;
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    code = `STAR${randomDigits}`;
    const existing = await User.findOne({ referralCode: code }).select('_id').lean();
    if (!existing) {
      isUnique = true;
    }
  }
  if (!isUnique) {
    code = `STAR${Date.now().toString().slice(-5)}`;
  }
  return code;
}

export function buildStandardUserPayload(user: any) {
  const refCode = user.referralCode || user.referral_code || '';
  return {
    id: user._id || user.id,
    username: user.username,
    email: user.email || '',
    phone: user.phone || '',
    avatar: user.avatar || '',
    balance: user.balance || 0,
    totalDeposit: user.totalDeposit ?? user.total_deposit ?? 0,
    total_deposit: user.totalDeposit ?? user.total_deposit ?? 0,
    totalWithdraw: user.totalWithdraw ?? user.total_withdraw ?? 0,
    total_withdraw: user.totalWithdraw ?? user.total_withdraw ?? 0,
    totalProfit: user.totalProfit ?? user.total_profit ?? 0,
    total_profit: user.totalProfit ?? user.total_profit ?? 0,
    referralCode: refCode,
    referral_code: refCode,
    referredBy: user.referredBy || user.referred_by || null,
    createdAt: user.createdAt || user.created_at || null
  };
}
