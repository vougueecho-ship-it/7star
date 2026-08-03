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

    await UserPlan.create({
      userId: user._id,
      planId: plan._id,
      planName: plan.name,
      investment: plan.price,
      dailyProfit: plan.dailyProfit,
      totalProfit: plan.totalProfit,
      lastClaim: new Date(),
      status: 'Active'
    });

    // Credit Level 1 & Level 2 Commissions
    if (user.referredBy) {
      const referrerL1 = await User.findOne({ referralCode: user.referredBy });
      if (referrerL1) {
        referrerL1.balance += plan.level1Bonus;
        referrerL1.totalProfit += plan.level1Bonus;
        await referrerL1.save();

        if (referrerL1.referredBy) {
          const referrerL2 = await User.findOne({ referralCode: referrerL1.referredBy });
          if (referrerL2) {
            referrerL2.balance += plan.level2Bonus;
            referrerL2.totalProfit += plan.level2Bonus;
            await referrerL2.save();
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully activated ${plan.name}! Daily mining starts now.`
    });
  } catch (err: any) {
    console.error('Plan activation error:', err);
    return NextResponse.json({ success: false, message: 'Server error activating plan' }, { status: 500 });
  }
}
