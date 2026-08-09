import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Withdrawal from '@/models/Withdrawal';
import { sendAdminFcmNotification } from '@/lib/sendAdminFcmNotification';

import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId, amount, gateway, accountTitle, accountNumber, bankName } = await req.json();

    if (!userId || !amount || !gateway || !accountTitle || !accountNumber) {
      return NextResponse.json({ success: false, message: 'Please fill all withdrawal details' }, { status: 400 });
    }

    await connectToDatabase();

    const isValidId = mongoose.Types.ObjectId.isValid(userId);
    const user = isValidId
      ? await User.findById(userId)
      : await User.findOne({ username: userId });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User account not found. Please log in again.' }, { status: 404 });
    }

    const numAmount = Number(amount);
    if (user.balance < numAmount) {
      return NextResponse.json({ success: false, message: 'Insufficient wallet balance' }, { status: 400 });
    }

    // Bonded Capital Check: Only earned daily mining profits & referral commissions are withdrawable
    const withdrawableProfit = user.totalProfit || 0;
    if (withdrawableProfit <= 0 || numAmount > withdrawableProfit) {
      return NextResponse.json({
        success: false,
        message: `Withdrawal limit exceeded! Invested capital is locked in active plans. You can only withdraw your earned daily mining profits & referral bonuses (Available Withdrawable Profit: PKR ${withdrawableProfit.toLocaleString()}).`
      }, { status: 400 });
    }

    user.balance -= numAmount;
    user.totalProfit = Math.max(0, user.totalProfit - numAmount);
    await user.save();

    const withdrawalRef = 'WIT' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90);

    await Withdrawal.create({
      withdrawalRef,
      userId: user._id,
      username: user.username,
      phone: user.phone,
      amount: numAmount,
      gateway,
      accountTitle,
      accountNumber,
      bankName: bankName || null,
      status: 'Pending'
    });

    // Send High-Priority FCM Push Notification to Admin App
    sendAdminFcmNotification({
      title: '👛 New Withdrawal Request!',
      body: `${user.username} requested a withdrawal of PKR ${numAmount.toLocaleString()} via ${gateway}. Tap to review!`,
      data: { type: 'withdrawal', tab: 'ledger' }
    }).catch(e => console.error('FCM notification error:', e));

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request submitted! Payout will be sent shortly.'
    });
  } catch (err: any) {
    console.error('Withdrawal API error:', err);
    return NextResponse.json({ success: false, message: 'Server error processing withdrawal' }, { status: 500 });
  }
}
