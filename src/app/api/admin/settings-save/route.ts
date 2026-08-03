import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Setting from '@/models/Setting';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const { settings } = await req.json();

    await connectToDatabase();

    for (const [key, value] of Object.entries(settings)) {
      await Setting.findOneAndUpdate(
        { key },
        { key, value: value as string },
        { upsert: true, new: true }
      );
    }

    return NextResponse.json({ success: true, message: 'Settings updated successfully!' });
  } catch (err: any) {
    console.error('Settings save error:', err);
    return NextResponse.json({ success: false, message: 'Error saving admin settings' }, { status: 500 });
  }
}
