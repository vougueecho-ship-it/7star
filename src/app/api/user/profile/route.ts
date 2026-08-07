import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import UserPlan from '@/models/UserPlan';
import Deposit from '@/models/Deposit';
import Withdrawal from '@/models/Withdrawal';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret7starjwtkey987654321';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);

    await connectToDatabase();

    const user = await User.findById(decoded.id).select('-passwordHash').lean();
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const refCode = (user.referralCode || '').trim();

    // Execute sub-queries in parallel via Promise.all with .lean() for maximum performance
    const [
      activePlans,
      allPlans,
      deposits,
      withdrawals,
      teamCount,
      teamList
    ] = await Promise.all([
      UserPlan.find({ userId: user._id, status: 'Active' }).lean(),
      UserPlan.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      Deposit.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      Withdrawal.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      refCode ? User.countDocuments({ referredBy: { $regex: new RegExp('^' + refCode + '$', 'i') } }) : 0,
      refCode ? User.find({ referredBy: { $regex: new RegExp('^' + refCode + '$', 'i') } }).select('username phone balance createdAt').sort({ createdAt: -1 }).lean() : []
    ]);

    const userObject = {
      id: user._id,
      username: user.username,
      phone: user.phone,
      balance: user.balance,
      total_deposit: user.totalDeposit,
      total_withdraw: user.totalWithdraw,
      total_profit: user.totalProfit,
      referral_code: user.referralCode,
      created_at: user.createdAt
    };

    return NextResponse.json({
      success: true,
      user: userObject,
      activePlans,
      allPlans,
      deposits,
      withdrawals,
      teamCount,
      teamList
    });
  } catch (err: any) {
    console.error('Profile API Error:', err);
    return NextResponse.json({ success: false, message: 'Session expired' }, { status: 401 });
  }
}

