import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret7starjwtkey987654321';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);

    const { phone } = await req.json();

    if (!phone || phone.trim().length === 0) {
      return NextResponse.json({ success: false, message: 'Please enter a valid mobile number' }, { status: 400 });
    }

    const cleanPhone = phone.trim();

    await connectToDatabase();

    const targetId = decoded.id || decoded.userId;
    const user = await User.findById(targetId);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Check if phone number is already used by another user
    const existingPhoneUser = await User.findOne({
      phone: cleanPhone,
      _id: { $ne: user._id }
    });

    if (existingPhoneUser) {
      return NextResponse.json({ success: false, message: 'This mobile number is already registered to another account' }, { status: 400 });
    }

    user.phone = cleanPhone;
    await user.save();

    const userObject = {
      id: user._id,
      username: user.username,
      email: user.email || '',
      phone: user.phone,
      balance: user.balance,
      total_deposit: user.totalDeposit,
      total_withdraw: user.totalWithdraw,
      total_profit: user.totalProfit,
      referral_code: user.referralCode
    };

    return NextResponse.json({
      success: true,
      message: 'Mobile number updated successfully!',
      user: userObject
    });
  } catch (err: any) {
    console.error('Update profile API error:', err);
    return NextResponse.json({ success: false, message: 'Server error updating profile' }, { status: 500 });
  }
}
