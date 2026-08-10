import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { sanitizeReferralCode } from '@/lib/referral';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const { userId, username, phone, newPassword, balance, referredBy } = await req.json();

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

    if (referredBy !== undefined) {
      const cleanRef = sanitizeReferralCode(referredBy);
      if (cleanRef) {
        // Validate if referrer code exists in database
        const safeRegex = new RegExp('^' + cleanRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
        const referrer = await User.findOne({ referralCode: { $regex: safeRegex } });
        if (!referrer) {
          return NextResponse.json({
            success: false,
            message: `Referrer code "${cleanRef}" does not exist in database!`
          }, { status: 400 });
        }
        if (referrer._id.toString() === user._id.toString()) {
          return NextResponse.json({
            success: false,
            message: 'A user cannot be set as their own referrer!'
          }, { status: 400 });
        }
        user.referredBy = referrer.referralCode;
      } else {
        user.referredBy = null;
      }
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
