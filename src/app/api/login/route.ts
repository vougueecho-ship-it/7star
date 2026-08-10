import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { generateUniqueReferralCode, buildStandardUserPayload } from '@/lib/referral';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret7starjwtkey987654321';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const cleanInput = String(username || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanInput || !cleanPassword) {
      return NextResponse.json({ success: false, message: 'Please enter username, email or phone and password' }, { status: 400 });
    }

    await connectToDatabase();

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inputRegex = new RegExp('^' + escapeRegex(cleanInput) + '$', 'i');
    const cleanInputLower = cleanInput.toLowerCase();

    // Phone digits normalization for robust Pakistani phone number matching (+92300... vs 0300...)
    const digitsOnly = cleanInput.replace(/[^0-9]/g, '');
    const phoneConditions: any[] = [{ phone: cleanInput }];
    if (digitsOnly.length >= 7) {
      const last10Digits = digitsOnly.slice(-10);
      phoneConditions.push({ phone: new RegExp(escapeRegex(last10Digits) + '$') });
    }

    const user = await User.findOne({
      $or: [
        { username: { $regex: inputRegex } },
        { email: cleanInputLower },
        { email: { $regex: inputRegex } },
        ...phoneConditions
      ]
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid username, email, phone, or password' }, { status: 401 });
    }

    if (!user.passwordHash) {
      return NextResponse.json({ success: false, message: 'Invalid username, email, phone, or password' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isValid) {
      // Helpful error message if user registered via Google
      if (user.googleId && user.passwordHash.startsWith('google_auth_user')) {
        return NextResponse.json({
          success: false,
          message: 'This account was created with Google. Please click "Continue with Google" to log in, or reset password.'
        }, { status: 401 });
      }
      return NextResponse.json({ success: false, message: 'Invalid username, email, phone, or password' }, { status: 401 });
    }

    if (!user.referralCode) {
      user.referralCode = await generateUniqueReferralCode();
      await user.save();
    }

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    const userObject = buildStandardUserPayload(user);

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      token,
      user: userObject
    });
  } catch (err: any) {
    console.error('Login API error:', err);
    return NextResponse.json({ success: false, message: 'Server error during login' }, { status: 500 });
  }
}
