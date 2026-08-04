import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Otp from '@/models/Otp';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ success: false, message: 'Please fill all required fields' }, { status: 400 });
    }

    await connectToDatabase();

    // Verify OTP
    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP verification code' }, { status: 400 });
    }

    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User with this email not found' }, { status: 404 });
    }

    // Delete OTP after verification
    await Otp.deleteOne({ _id: validOtp._id });

    // Hash and update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    return NextResponse.json({ success: true, message: 'Password reset successful! You can now log in.' });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ success: false, message: 'Server error resetting password' }, { status: 500 });
  }
}
