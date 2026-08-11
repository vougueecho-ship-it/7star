import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { generateUniqueReferralCode, buildStandardUserPayload } from '@/lib/referral';
import User from '@/models/User';
import UserPlan from '@/models/UserPlan';
import Deposit from '@/models/Deposit';
import Withdrawal from '@/models/Withdrawal';
import jwt from 'jsonwebtoken';

import mongoose from 'mongoose';

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

    const targetId = decoded.id || decoded.userId;
    const isValidId = mongoose.Types.ObjectId.isValid(targetId);
    let user = isValidId
      ? await User.findById(targetId).select('-passwordHash')
      : await User.findOne({ username: decoded.username }).select('-passwordHash');

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    if (!user.referralCode) {
      user.referralCode = await generateUniqueReferralCode();
      await user.save();
    }

    const refCode = (user.referralCode || '').trim();

    // 1. Fetch User Active/All Plans, Deposits, Withdrawals
    const [
      activePlans,
      allPlans,
      deposits,
      withdrawals
    ] = await Promise.all([
      UserPlan.find({ userId: user._id, status: 'Active' }).lean(),
      UserPlan.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      Deposit.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      Withdrawal.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).lean()
    ]);

    // 2. Fetch Level 1 Members using case-insensitive regex search
    const refCodeUpper = refCode ? refCode.trim().toUpperCase() : '';
    const safeRegexL1 = refCodeUpper
      ? new RegExp('^' + refCodeUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
      : null;

    const level1ListRaw: any[] = safeRegexL1
      ? await User.find({ referredBy: { $regex: safeRegexL1 } })
          .select('username email phone referralCode createdAt balance')
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Map L1 Leader Username by referralCode
    const l1LeaderMap: Record<string, string> = {};
    level1ListRaw.forEach((u: any) => {
      if (u.referralCode) {
        l1LeaderMap[u.referralCode.toUpperCase()] = u.username;
      }
    });

    // 3. Fetch Level 2 Members
    const l1RefCodes = level1ListRaw.map((u: any) => u.referralCode).filter(Boolean);
    const l1RefCodesVariations: string[] = [];
    l1RefCodes.forEach((c: string) => {
      l1RefCodesVariations.push(c, c.toUpperCase(), c.toLowerCase());
    });

    const level2ListRaw: any[] = (refCode && l1RefCodesVariations.length > 0)
      ? await User.find({ referredBy: { $in: l1RefCodesVariations } })
          .select('username email phone referralCode referredBy createdAt balance')
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // 4. Fetch UserPlan for all L1 & L2 members to compute active & total investment & commissions
    const allTeamUserIds = [
      ...level1ListRaw.map((u: any) => u._id),
      ...level2ListRaw.map((u: any) => u._id)
    ];

    const teamUserPlans: any[] = allTeamUserIds.length > 0
      ? await UserPlan.find({ userId: { $in: allTeamUserIds } }).lean()
      : [];

    // Map plans by userId
    const plansByUserId: Record<string, { totalInvested: number; activeInvested: number; activeDailyProfit: number }> = {};

    teamUserPlans.forEach((p: any) => {
      const uId = p.userId.toString();
      if (!plansByUserId[uId]) {
        plansByUserId[uId] = { totalInvested: 0, activeInvested: 0, activeDailyProfit: 0 };
      }
      const inv = Number(p.investment || 0);
      plansByUserId[uId].totalInvested += inv;
      if (p.status === 'Active') {
        plansByUserId[uId].activeInvested += inv;
        plansByUserId[uId].activeDailyProfit += Number(p.dailyProfit || 0);
      }
    });

    let level1TotalCommission = 0;
    let level1DailyCommission = 0;

    const level1List = level1ListRaw.map((m: any) => {
      const uId = m._id.toString();
      const pStats = plansByUserId[uId] || { totalInvested: 0, activeInvested: 0, activeDailyProfit: 0 };
      const totalComm = Math.round((pStats.totalInvested * 0.10) * 100) / 100;
      const dailyComm = Math.round((pStats.activeDailyProfit * 0.10) * 100) / 100;
      level1TotalCommission += totalComm;
      level1DailyCommission += dailyComm;

      return {
        id: m._id,
        _id: m._id,
        username: m.username,
        email: m.email || '',
        phone: m.phone,
        referralCode: m.referralCode,
        createdAt: m.createdAt,
        totalInvested: pStats.totalInvested,
        activeInvested: pStats.activeInvested,
        activeDailyProfit: pStats.activeDailyProfit,
        totalCommission: totalComm,
        dailyCommission: dailyComm
      };
    });

    let level2TotalCommission = 0;
    let level2DailyCommission = 0;

    const level2List = level2ListRaw.map((m: any) => {
      const uId = m._id.toString();
      const pStats = plansByUserId[uId] || { totalInvested: 0, activeInvested: 0, activeDailyProfit: 0 };
      const totalComm = Math.round((pStats.totalInvested * 0.02) * 100) / 100;
      const dailyComm = Math.round((pStats.activeDailyProfit * 0.02) * 100) / 100;
      level2TotalCommission += totalComm;
      level2DailyCommission += dailyComm;

      const refCodeKey = (m.referredBy || '').toUpperCase();
      const l1LeaderName = l1LeaderMap[refCodeKey] || m.referredBy || 'L1 Leader';

      return {
        id: m._id,
        _id: m._id,
        username: m.username,
        email: m.email || '',
        phone: m.phone,
        referralCode: m.referralCode,
        referredBy: m.referredBy,
        referredByName: l1LeaderName,
        createdAt: m.createdAt,
        totalInvested: pStats.totalInvested,
        activeInvested: pStats.activeInvested,
        activeDailyProfit: pStats.activeDailyProfit,
        totalCommission: totalComm,
        dailyCommission: dailyComm
      };
    });

    const level1Count = level1List.length;
    const level2Count = level2List.length;
    const teamTotalCommission = Math.round((level1TotalCommission + level2TotalCommission) * 100) / 100;
    const teamDailyCommission = Math.round((level1DailyCommission + level2DailyCommission) * 100) / 100;

    const userObject = buildStandardUserPayload(user);

    return NextResponse.json({
      success: true,
      user: userObject,
      activePlans,
      allPlans,
      deposits,
      withdrawals,
      teamCount: level1Count + level2Count,
      level1Count,
      level2Count,
      level1TotalCommission,
      level1DailyCommission,
      level2TotalCommission,
      level2DailyCommission,
      teamTotalCommission,
      teamDailyCommission,
      teamList: level1List, // backwards compatibility
      level1List,
      level2List
    });
  } catch (err: any) {
    console.error('Profile API Error:', err);
    return NextResponse.json({ success: false, message: 'Session expired' }, { status: 401 });
  }
}

