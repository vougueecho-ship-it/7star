import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Setting from '@/models/Setting';
import Plan from '@/models/Plan';

export const dynamic = 'force-dynamic';

const DEFAULT_PLANS = [
  { name: 'VIP 1 Star', price: 750, dailyProfit: 62, totalProfit: 4800, validityDays: 12, level1Bonus: 38, level2Bonus: 12, active: true },
  { name: 'VIP 2 Star', price: 1500, dailyProfit: 125, totalProfit: 10000, validityDays: 12, level1Bonus: 75, level2Bonus: 30, active: true },
  { name: 'VIP 3 Star', price: 3000, dailyProfit: 250, totalProfit: 20800, validityDays: 12, level1Bonus: 150, level2Bonus: 60, active: true },
  { name: 'VIP 4 Star', price: 6000, dailyProfit: 500, totalProfit: 44000, validityDays: 12, level1Bonus: 300, level2Bonus: 120, active: true },
  { name: 'VIP 5 Star', price: 12000, dailyProfit: 1000, totalProfit: 92000, validityDays: 12, level1Bonus: 600, level2Bonus: 240, active: true },
  { name: 'VIP 6 Star', price: 25000, dailyProfit: 2083, totalProfit: 83333, validityDays: 12, level1Bonus: 1250, level2Bonus: 500, active: true },
  { name: 'VIP 7 Star', price: 40000, dailyProfit: 3333, totalProfit: 133333, validityDays: 12, level1Bonus: 2000, level2Bonus: 800, active: true },
  { name: 'VIP 8 Star', price: 60000, dailyProfit: 5000, totalProfit: 200000, validityDays: 12, level1Bonus: 3000, level2Bonus: 1200, active: true },
  { name: 'VIP 9 Star', price: 80000, dailyProfit: 6666, totalProfit: 266666, validityDays: 12, level1Bonus: 4000, level2Bonus: 1600, active: true },
  { name: 'VIP 10 Star', price: 100000, dailyProfit: 8333, totalProfit: 333333, validityDays: 12, level1Bonus: 5000, level2Bonus: 2000, active: true }
];

export async function GET() {
  try {
    await connectToDatabase();

    // Check if plans exist, if not seed default VIP 1 to VIP 10 plans
    let plans = await Plan.find({ active: { $ne: false } }).sort({ price: 1 });
    if (plans.length === 0) {
      await Plan.create(DEFAULT_PLANS);
      plans = await Plan.find({ active: { $ne: false } }).sort({ price: 1 });
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
