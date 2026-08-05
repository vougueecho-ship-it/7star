import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import UserPlan from '@/models/UserPlan';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId, userPlanId } = await req.json();

    if (!userId || !userPlanId) {
      return NextResponse.json({ success: false, message: 'Missing user ID or plan ID' }, { status: 400 });
    }

    await connectToDatabase();

    const userPlan = await UserPlan.findOne({ _id: userPlanId, userId, status: 'Active' });
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
