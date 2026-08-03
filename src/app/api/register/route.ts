import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret7starjwtkey987654321';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { username, phone, password, ref } = await req.json();

    if (!username || !phone || !password) {
      return NextResponse.json({ success: false, message: 'Please fill all required fields' }, { status: 400 });
    }

    await connectToDatabase();

    const existing = await User.findOne({
      $or: [{ username }, { phone }]
    });

    if (existing) {
      return NextResponse.json({ success: false, message: 'Username or phone number already registered' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const referralCode = 'STAR' + Math.floor(10000 + Math.random() * 90000);

    const newUser = await User.create({
      username,
      phone,
      passwordHash,
      referralCode,
      referredBy: ref || null
    });

    const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '30d' });

    const userObject = {
      id: newUser._id,
      username: newUser.username,
      phone: newUser.phone,
      balance: newUser.balance,
      totalDeposit: newUser.totalDeposit,
      totalWithdraw: newUser.totalWithdraw,
      totalProfit: newUser.totalProfit,
      referralCode: newUser.referralCode
    };

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
