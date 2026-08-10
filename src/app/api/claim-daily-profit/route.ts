import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import UserPlan from '@/models/UserPlan';

import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId, userPlanId } = await req.json();

    if (!userId || !userPlanId) {
      return NextResponse.json({ success: false, message: 'Missing user ID or plan ID' }, { status: 400 });
    }

    await connectToDatabase();

    const isValidUserPlan = mongoose.Types.ObjectId.isValid(userPlanId);
    const isValidUser = mongoose.Types.ObjectId.isValid(userId);

    if (!isValidUserPlan) {
      return NextResponse.json({ success: false, message: 'Invalid active plan ID' }, { status: 400 });
    }

    const userPlan = await UserPlan.findOne({ _id: userPlanId, status: 'Active' });
    if (!userPlan) {
      return NextResponse.json({ success: false, message: 'Active investment plan not found' }, { status: 404 });
    }

    const maxClaims = userPlan.validityDays || 12;
    const currentClaims = userPlan.claimsCount || 0;

    if (currentClaims >= maxClaims) {
      userPlan.status = 'Completed';
      await userPlan.save();
      return NextResponse.json({
        success: false,
        message: `This ${maxClaims}-day investment plan cycle has been fully completed and expired!`
      }, { status: 400 });
    }

    const lastClaim = new Date(userPlan.lastClaim || userPlan.createdAt);
    const now = new Date();
    const diffHours = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      const remainingHours = Math.ceil(24 - diffHours);
      return NextResponse.json({
        success: false,
        message: `Mining output is compiling. Next claim available in ${remainingHours} hour(s).`
      }, { status: 400 });
    }

    const profitAmount = Number(userPlan.dailyProfit);

    const user = await User.findById(userId);
    if (user) {
      user.balance += profitAmount;
      user.totalProfit += profitAmount;
      await user.save();

      // Credit Level 1 & Level 2 Referral Daily Profit Share Bonuses (10% Direct & 2% Indirect)
      if (user.referredBy) {
        const cleanRefCode = user.referredBy.trim();
        const safeL1Regex = new RegExp('^' + cleanRefCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
        const referrerL1 = await User.findOne({
          referralCode: { $regex: safeL1Regex }
        });

        if (referrerL1) {
          const level1DailyBonus = Math.round(profitAmount * 0.10);
          if (level1DailyBonus > 0) {
            referrerL1.balance += level1DailyBonus;
            referrerL1.totalProfit += level1DailyBonus; // Added to totalProfit so it can be withdrawn
            await referrerL1.save();
          }

          if (referrerL1.referredBy) {
            const cleanL2RefCode = referrerL1.referredBy.trim();
            const safeL2Regex = new RegExp('^' + cleanL2RefCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
            const referrerL2 = await User.findOne({
              referralCode: { $regex: safeL2Regex }
            });

            if (referrerL2) {
              const level2DailyBonus = Math.round(profitAmount * 0.02);
              if (level2DailyBonus > 0) {
                referrerL2.balance += level2DailyBonus;
                referrerL2.totalProfit += level2DailyBonus; // Added to totalProfit so it can be withdrawn
                await referrerL2.save();
              }
            }
          }
        }
      }
    }

    userPlan.lastClaim = new Date();
    userPlan.claimsCount = currentClaims + 1;
    if (userPlan.claimsCount >= maxClaims) {
      userPlan.status = 'Completed';
    }
    await userPlan.save();

    return NextResponse.json({
      success: true,
      message: userPlan.status === 'Completed'
        ? `Successfully claimed PKR ${profitAmount}! Final claim reached — plan status is now Completed.`
        : `Successfully claimed PKR ${profitAmount} daily mining profit! (${userPlan.claimsCount}/${maxClaims} days claimed)`,
      profit: profitAmount
    });
  } catch (err: any) {
    console.error('Claim daily profit error:', err);
    return NextResponse.json({ success: false, message: 'Server error claiming profit' }, { status: 500 });
  }
}
