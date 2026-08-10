import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { sanitizeReferralCode, generateUniqueReferralCode, buildStandardUserPayload } from '@/lib/referral';
import User from '@/models/User';
import Otp from '@/models/Otp';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret7starjwtkey987654321';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { username, email, phone, password, otp, ref } = await req.json();

    const cleanUsername = String(username || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanPassword = String(password || '').trim();
    const cleanOtp = String(otp || '').trim();

    if (!cleanUsername || !cleanEmail || !cleanPhone || !cleanPassword || !cleanOtp) {
      return NextResponse.json({ success: false, message: 'Please fill all required fields including Email OTP' }, { status: 400 });
    }

    await connectToDatabase();

    // Verify OTP
    const validOtp = await Otp.findOne({ email: cleanEmail, otp: cleanOtp });
    if (!validOtp) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP verification code' }, { status: 400 });
    }

    // Delete OTP after verification
    await Otp.deleteOne({ _id: validOtp._id });

    // Check if username, email, or phone is already registered (case-insensitive)
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await User.findOne({
      $or: [
        { username: { $regex: new RegExp('^' + escapeRegex(cleanUsername) + '$', 'i') } },
        { email: cleanEmail },
        { phone: cleanPhone }
      ]
    });

    if (existing) {
      return NextResponse.json({ success: false, message: 'Username, Email, or Phone number already registered' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    const referralCode = await generateUniqueReferralCode();
    const cleanReferredBy = sanitizeReferralCode(ref);

    const newUser = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      referralCode,
      referredBy: cleanReferredBy
    });

    const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '30d' });
    const userObject = buildStandardUserPayload(newUser);

    return NextResponse.json({
      success: true,
      message: 'Account registered successfully!',
      token,
      user: userObject
    });
  } catch (err: any) {
    console.error('Register API error:', err);
    return NextResponse.json({ success: false, message: 'Server error during registration' }, { status: 500 });
  }
}
