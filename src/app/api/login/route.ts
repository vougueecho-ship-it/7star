import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret7starjwtkey987654321';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Please enter username and password' }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findOne({
      $or: [{ username }, { phone: username }, { email: username }]
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid username, email, or password' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid username or password' }, { status: 401 });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    const userObject = {
      id: user._id,
      username: user.username,
      phone: user.phone,
      balance: user.balance,
      total_deposit: user.totalDeposit,
      total_withdraw: user.totalWithdraw,
      total_profit: user.totalProfit,
      referral_code: user.referralCode
    };

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
