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
    await userPlan.save();

    return NextResponse.json({
      success: true,
      message: `Successfully claimed PKR ${profitAmount} daily mining profit!`,
      profit: profitAmount
    });
  } catch (err: any) {
    console.error('Claim daily profit error:', err);
    return NextResponse.json({ success: false, message: 'Server error claiming profit' }, { status: 500 });
  }
}
