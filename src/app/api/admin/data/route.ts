import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Deposit from '@/models/Deposit';
import Withdrawal from '@/models/Withdrawal';
import Plan from '@/models/Plan';
import Setting from '@/models/Setting';
import UserPlan from '@/models/UserPlan';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const [
      users,
      deposits,
      withdrawals,
      plans,
      userPlans,
      settingsRows
    ] = await Promise.all([
      User.find({}).sort({ createdAt: -1 }).select('-passwordHash').lean(),
      Deposit.find({}).sort({ createdAt: -1 }).lean(),
      Withdrawal.find({}).sort({ createdAt: -1 }).lean(),
      Plan.find({}).sort({ price: 1 }).lean(),
      UserPlan.find({}).sort({ createdAt: -1 }).lean(),
      Setting.find({}).lean()
    ]);

    const settings: Record<string, string> = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });

    const formattedUsers = users.map((u) => ({
      id: u._id,
      _id: u._id,
      username: u.username,
      phone: u.phone,
      balance: u.balance || 0,
      total_deposit: u.totalDeposit || 0,
      totalDeposit: u.totalDeposit || 0,
      total_withdraw: u.totalWithdraw || 0,
      totalWithdraw: u.totalWithdraw || 0,
      total_profit: u.totalProfit || 0,
      totalProfit: u.totalProfit || 0,
      referral_code: u.referralCode || '',
      referralCode: u.referralCode || '',
      referred_by: u.referredBy || '',
      referredBy: u.referredBy || '',
      created_at: u.createdAt
    }));

    const formattedDeposits = deposits.map((d) => ({
      id: d._id,
      _id: d._id,
      deposit_ref: d.depositRef,
      depositRef: d.depositRef,
      user_id: d.userId,
      userId: d.userId,
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
      _id: w._id,
      withdrawal_ref: w.withdrawalRef,
      withdrawalRef: w.withdrawalRef,
      user_id: w.userId,
      userId: w.userId,
      username: w.username,
      phone: w.phone,
      amount: w.amount,
      gateway: w.gateway,
      account_title: w.accountTitle,
      accountTitle: w.accountTitle,
      account_number: w.accountNumber,
      accountNumber: w.accountNumber,
      bank_name: w.bankName,
      bankName: w.bankName,
      status: w.status,
      reason: w.reason || null,
      created_at: w.createdAt
    }));

    const formattedPlans = plans.map((p) => ({
      id: p._id,
      _id: p._id,
      name: p.name,
      price: p.price,
      dailyProfit: p.dailyProfit,
      daily_profit: p.dailyProfit,
      totalProfit: p.totalProfit,
      total_profit: p.totalProfit,
      validityDays: p.validityDays,
      validity_days: p.validityDays,
      level1Bonus: p.level1Bonus,
      level1_bonus: p.level1Bonus,
      level2Bonus: p.level2Bonus,
      level2_bonus: p.level2Bonus,
      active: p.active
    }));

    const formattedUserPlans = userPlans.map((up) => ({
      id: up._id,
      _id: up._id,
      userId: up.userId,
      user_id: up.userId,
      planId: up.planId,
      plan_id: up.planId,
      planName: up.planName,
      plan_name: up.planName,
      investment: up.investment,
      dailyProfit: up.dailyProfit,
      daily_profit: up.dailyProfit,
      totalProfit: up.totalProfit,
      total_profit: up.totalProfit,
      validityDays: up.validityDays,
      validity_days: up.validityDays,
      claimsCount: up.claimsCount,
      claims_count: up.claimsCount,
      lastClaim: up.lastClaim,
      status: up.status,
      created_at: up.createdAt
    }));

    return NextResponse.json({
      users: formattedUsers,
      deposits: formattedDeposits,
      withdrawals: formattedWithdrawals,
      plans: formattedPlans,
      activeUserPlans: formattedUserPlans,
      settings
    });
  } catch (err: any) {
    console.error('Admin data fetch error:', err);
    return NextResponse.json({ success: false, message: 'Server error fetching admin data' }, { status: 500 });
  }
}
