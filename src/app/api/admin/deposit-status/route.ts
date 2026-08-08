import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Deposit from '@/models/Deposit';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const { depositId, status } = await req.json();

    await connectToDatabase();

    const deposit = await Deposit.findById(depositId);
    if (!deposit) {
      return NextResponse.json({ success: false, message: 'Deposit not found' }, { status: 404 });
    }

    if (deposit.status === 'Pending' && status === 'Approved') {
      deposit.status = 'Approved';
      await deposit.save();

      const user = await User.findById(deposit.userId);
      if (user) {
        user.balance += deposit.amount;
        user.totalDeposit += deposit.amount;
        await user.save();

        // Credit Level 1 & Level 2 Referral Deposit Bonuses (10% Direct & 5% Indirect)
        if (user.referredBy) {
          const cleanRefCode = user.referredBy.trim();
          const referrerL1 = await User.findOne({
            referralCode: { $regex: new RegExp('^' + cleanRefCode + '$', 'i') }
          });

          if (referrerL1) {
            const level1Bonus = Math.round(deposit.amount * 0.10);
            if (level1Bonus > 0) {
              referrerL1.balance += level1Bonus;
              referrerL1.totalProfit += level1Bonus; // Added to totalProfit so it can be withdrawn
              await referrerL1.save();
            }

            if (referrerL1.referredBy) {
              const cleanL2RefCode = referrerL1.referredBy.trim();
              const referrerL2 = await User.findOne({
                referralCode: { $regex: new RegExp('^' + cleanL2RefCode + '$', 'i') }
              });

              if (referrerL2) {
                const level2Bonus = Math.round(deposit.amount * 0.05);
                if (level2Bonus > 0) {
                  referrerL2.balance += level2Bonus;
                  referrerL2.totalProfit += level2Bonus; // Added to totalProfit so it can be withdrawn
                  await referrerL2.save();
                }
              }
            }
          }
        }
      }
    } else if (status === 'Rejected') {
      deposit.status = 'Rejected';
      await deposit.save();
    }

    return NextResponse.json({ success: true, message: `Deposit ${status}!` });
  } catch (err: any) {
    console.error('Deposit status error:', err);
    return NextResponse.json({ success: false, message: 'Error updating deposit status' }, { status: 500 });
  }
}
