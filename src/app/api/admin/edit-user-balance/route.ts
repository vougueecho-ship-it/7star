import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const { userId, balance } = await req.json();

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    user.balance = Number(balance);
    await user.save();

    return NextResponse.json({ success: true, message: 'User balance updated!' });
  } catch (err: any) {
    console.error('Edit balance error:', err);
    return NextResponse.json({ success: false, message: 'Error updating user balance' }, { status: 500 });
  }
}
