import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Deposit from '@/models/Deposit';
import Withdrawal from '@/models/Withdrawal';
import Plan from '@/models/Plan';
import Setting from '@/models/Setting';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const users = await User.find({}).sort({ createdAt: -1 }).select('-passwordHash');
    const deposits = await Deposit.find({}).sort({ createdAt: -1 });
    const withdrawals = await Withdrawal.find({}).sort({ createdAt: -1 });
    const plans = await Plan.find({}).sort({ price: 1 });
    const settingsRows = await Setting.find({});

    const settings: Record<string, string> = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });

    const formattedUsers = users.map((u) => ({
      id: u._id,
      username: u.username,
      phone: u.phone,
      balance: u.balance,
      total_deposit: u.totalDeposit,
      total_withdraw: u.totalWithdraw,
      total_profit: u.totalProfit,
      referral_code: u.referralCode,
      referred_by: u.referredBy,
      created_at: u.createdAt
    }));

    const formattedDeposits = deposits.map((d) => ({
      id: d._id,
      deposit_ref: d.depositRef,
      user_id: d.userId,
      username: d.username,
      phone: d.phone,
      amount: d.amount,
      gateway: d.gateway,
      tid: d.tid,
      screenshot: d.screenshot,
      status: d.status,
      created_at: d.createdAt
    }));

    const formattedWithdrawals = withdrawals.map((w) => ({
      id: w._id,
      withdrawal_ref: w.withdrawalRef,
      user_id: w.userId,
      username: w.username,
      phone: w.phone,
      amount: w.amount,
      gateway: w.gateway,
      account_title: w.accountTitle,
      account_number: w.accountNumber,
      bank_name: w.bankName,
      status: w.status,
      created_at: w.createdAt
    }));

    const formattedPlans = plans.map((p) => ({
      id: p._id,
      name: p.name,
      price: p.price,
      daily_profit: p.dailyProfit,
      total_profit: p.totalProfit,
      validity_days: p.validityDays,
      level1_bonus: p.level1Bonus,
      level2_bonus: p.level2Bonus,
      active: p.active
    }));

    return NextResponse.json({
      users: formattedUsers,
      deposits: formattedDeposits,
      withdrawals: formattedWithdrawals,
      plans: formattedPlans,
      settings
    });
  } catch (err: any) {
    console.error('Admin data fetch error:', err);
    return NextResponse.json({ success: false, message: 'Server error fetching admin data' }, { status: 500 });
  }
}
