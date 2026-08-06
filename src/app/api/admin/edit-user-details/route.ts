import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const { userId, username, phone, newPassword, balance } = await req.json();

    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    if (username && username.trim().length > 0) {
      user.username = username.trim();
    }

    if (phone && phone.trim().length > 0) {
      user.phone = phone.trim();
    }

    if (balance !== undefined && balance !== null && !isNaN(Number(balance))) {
      user.balance = Number(balance);
    }

    if (newPassword && newPassword.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(newPassword.trim(), salt);
    }

    await user.save();

    return NextResponse.json({
      success: true,
      message: `User details for ${user.username} updated successfully.`
    });
  } catch (err: any) {
    console.error('Edit user details error:', err);
    return NextResponse.json({ success: false, message: 'Server error updating user details' }, { status: 500 });
  }
}
