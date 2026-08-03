import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Plan from '@/models/Plan';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const plans = await Plan.find({}).sort({ price: 1 });
    return NextResponse.json({ success: true, plans });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    await connectToDatabase();

    const planId = body.id || body.planId;
    const planData = {
      name: body.name,
      price: Number(body.price || body.amount),
      dailyProfit: Number(body.dailyProfit || body.daily_profit),
      totalProfit: Number(body.totalProfit || body.total_profit || (Number(body.dailyProfit || body.daily_profit) * Number(body.validityDays || body.validity_days || 40))),
      validityDays: Number(body.validityDays || body.validity_days || 40),
      level1Bonus: Number(body.level1Bonus || body.level1_bonus || 0),
      level2Bonus: Number(body.level2Bonus || body.level2_bonus || 0),
      active: body.active !== undefined ? Boolean(body.active) : true
    };

    if (planId) {
      const updatedPlan = await Plan.findByIdAndUpdate(planId, planData, { new: true });
      return NextResponse.json({ success: true, message: 'VIP Plan updated successfully!', plan: updatedPlan });
    } else {
      const newPlan = await Plan.create(planData);
      return NextResponse.json({ success: true, message: 'VIP Plan created successfully!', plan: newPlan });
    }
  } catch (err: any) {
    console.error('Plan save error:', err);
    return NextResponse.json({ success: false, message: 'Failed to save VIP plan' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get('id');

    if (!planId) {
      return NextResponse.json({ success: false, message: 'Plan ID required' }, { status: 400 });
    }

    await connectToDatabase();
    await Plan.findByIdAndDelete(planId);

    return NextResponse.json({ success: true, message: 'VIP Plan deleted successfully!' });
  } catch (err: any) {
    console.error('Plan delete error:', err);
    return NextResponse.json({ success: false, message: 'Failed to delete VIP plan' }, { status: 500 });
  }
}
