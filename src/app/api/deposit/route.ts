import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Deposit from '@/models/Deposit';
import { sendAdminFcmNotification } from '@/lib/sendAdminFcmNotification';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId, amount, gateway, tid, screenshotData } = await req.json();

    if (!userId || !amount || !gateway || !tid || !screenshotData) {
      return NextResponse.json({ success: false, message: 'Please enter all details and upload payment receipt screenshot proof.' }, { status: 400 });
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

    // Send High-Priority FCM Push Notification to Admin App
    sendAdminFcmNotification({
      title: '💰 New Deposit Request!',
      body: `${user.username} submitted a deposit of PKR ${Number(amount).toLocaleString()} via ${gateway}. Tap to review!`,
      data: { type: 'deposit', tab: 'ledger' }
    }).catch(e => console.error('FCM notification error:', e));

    return NextResponse.json({
      success: true,
      message: 'Deposit request submitted successfully! Waiting for Admin verification.'
    });
  } catch (err: any) {
    console.error('Deposit submission error:', err);
    return NextResponse.json({ success: false, message: 'Server error processing deposit' }, { status: 500 });
  }
}
