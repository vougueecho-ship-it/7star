import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Setting from '@/models/Setting';
import Plan from '@/models/Plan';

export const dynamic = 'force-dynamic';

const DEFAULT_PLANS = [
  { name: 'VIP 1', price: 750, dailyProfit: 200, totalProfit: 2400, validityDays: 12, level1Bonus: 10, level2Bonus: 4, active: true },
  { name: 'VIP 2', price: 1850, dailyProfit: 500, totalProfit: 6000, validityDays: 12, level1Bonus: 25, level2Bonus: 10, active: true },
  { name: 'VIP 3', price: 3500, dailyProfit: 950, totalProfit: 11400, validityDays: 12, level1Bonus: 48, level2Bonus: 19, active: true },
  { name: 'VIP 4', price: 7000, dailyProfit: 1900, totalProfit: 22800, validityDays: 12, level1Bonus: 95, level2Bonus: 38, active: true },
  { name: 'VIP 5', price: 15050, dailyProfit: 3750, totalProfit: 45000, validityDays: 12, level1Bonus: 188, level2Bonus: 75, active: true },
  { name: 'VIP 6', price: 32990, dailyProfit: 14000, totalProfit: 168000, validityDays: 12, level1Bonus: 700, level2Bonus: 280, active: true },
  { name: 'VIP 7', price: 53790, dailyProfit: 31000, totalProfit: 372000, validityDays: 12, level1Bonus: 1550, level2Bonus: 620, active: true },
  { name: 'VIP 8', price: 80000, dailyProfit: 50000, totalProfit: 600000, validityDays: 12, level1Bonus: 2500, level2Bonus: 1000, active: true }
];

export async function GET() {
  try {
    await connectToDatabase();

    // Check if plans exist, if not seed default VIP 1 to VIP 8 plans
    let plans = await Plan.find({ active: true }).sort({ price: 1 });
    if (plans.length === 0) {
      await Plan.create(DEFAULT_PLANS);
      plans = await Plan.find({ active: true }).sort({ price: 1 });
    } else {
      // Update any plans with validityDays != 12
      await Plan.updateMany({ validityDays: { $ne: 12 } }, { $set: { validityDays: 12 } });
      plans = await Plan.find({ active: true }).sort({ price: 1 });
    }

    // Check settings, if empty seed defaults
    const defaultSettings: Record<string, string> = {
      site_name: '7 STAR INVEST',
      notice_text: '🌟 Welcome to 7 STAR INVEST - Halal & Trusted Earning Platform 💯 | Daily Returns Credited Automatically!',
      easypaisa_title: 'Muhammad ikaram',
      easypaisa_number: '03438275273',
      whatsapp_number: '03438275273',
      min_withdraw: '100',
      max_withdraw: '500000'
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      const exists = await Setting.findOne({ key });
      if (!exists) {
        await Setting.create({ key, value });
      }
    }

    const settingsRows = await Setting.find({});
    const settings: Record<string, string> = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });

    return NextResponse.json({ settings, plans });
  } catch (err: any) {
    console.error('Config API error:', err);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}
