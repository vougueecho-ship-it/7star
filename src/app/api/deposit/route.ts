import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Deposit from '@/models/Deposit';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId, amount, gateway, tid, screenshotData } = await req.json();

    if (!userId || !amount || !gateway || !tid) {
      return NextResponse.json({ success: false, message: 'Please fill all deposit details' }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    let screenshotPath: string | null = screenshotData || null;

    if (screenshotData && screenshotData.startsWith('data:image')) {
      try {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const base64Data = screenshotData.replace(/^data:image\/\w+;base64,/, '');
        const fileName = `dep_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
        fs.writeFileSync(path.join(uploadsDir, fileName), base64Data, 'base64');
        screenshotPath = `/uploads/${fileName}`;
      } catch (e) {
        // Fallback to storing raw base64 data URL directly for Vercel serverless environment
        screenshotPath = screenshotData;
      }
    }

    const depositRef = 'DEP' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90);

    await Deposit.create({
      depositRef,
      userId: user._id,
      username: user.username,
      phone: user.phone,
      amount: Number(amount),
      gateway,
      tid,
      screenshot: screenshotPath,
      status: 'Pending'
    });

    return NextResponse.json({
      success: true,
      message: 'Deposit request submitted successfully! Waiting for Admin verification.'
    });
  } catch (err: any) {
    console.error('Deposit submission error:', err);
    return NextResponse.json({ success: false, message: 'Server error processing deposit' }, { status: 500 });
  }
}
