import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Setting from '@/models/Setting';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, message: 'Missing FCM token' }, { status: 400 });
    }

    await connectToDatabase();

    let setting = await Setting.findOne({ key: 'admin_fcm_tokens' });
    let tokens: string[] = [];

    if (setting && setting.value) {
      try {
        tokens = JSON.parse(setting.value);
      } catch (e) {
        tokens = [setting.value];
      }
    }

    if (!tokens.includes(token)) {
      tokens.push(token);
    }

    if (!setting) {
      setting = new Setting({
        key: 'admin_fcm_tokens',
        value: JSON.stringify(tokens)
      });
    } else {
      setting.value = JSON.stringify(tokens);
    }

    await setting.save();

    return NextResponse.json({
      success: true,
      message: 'Admin FCM token registered successfully!'
    });
  } catch (err: any) {
    console.error('FCM Token API error:', err);
    return NextResponse.json({ success: false, message: 'Server error saving FCM token' }, { status: 500 });
  }
}
