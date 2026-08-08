import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Plan from '@/models/Plan';
import UserPlan from '@/models/UserPlan';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId, planId } = await req.json();

    if (!userId || !planId) {
      return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    const plan = await Plan.findById(planId);

    if (!user || !plan) {
      return NextResponse.json({ success: false, message: 'Invalid plan or user' }, { status: 400 });
    }

    if (user.balance < plan.price) {
      return NextResponse.json({
        success: false,
        message: `Insufficient balance. ${plan.name} costs PKR ${plan.price}. Please deposit first.`
      }, { status: 400 });
    }

    user.balance -= plan.price;
    await user.save();

    const planValidity = plan.validityDays || 12;
    const planTotalProfit = plan.dailyProfit * planValidity;

    await UserPlan.create({
      userId: user._id,
      planId: plan._id,
      planName: plan.name,
      investment: plan.price,
      dailyProfit: plan.dailyProfit,
      totalProfit: planTotalProfit,
      validityDays: planValidity,
      claimsCount: 0,
      lastClaim: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'Active'
    });

    return NextResponse.json({
      success: true,
      message: `Successfully activated ${plan.name}! Daily mining starts now.`
    });
  } catch (err: any) {
    console.error('Plan activation error:', err);
    return NextResponse.json({ success: false, message: 'Server error activating plan' }, { status: 500 });
  }
}
