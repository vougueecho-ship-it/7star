import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Deposit from '@/models/Deposit';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

function sanitizeReferralCode(ref: any): string | null {
  if (!ref) return null;
  const str = String(ref).trim();
  if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null' || str.toLowerCase() === 'none' || str.toLowerCase() === 'false' || str === '0') {
    return null;
  }
  return str.toUpperCase();
}

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

    const depAmount = Number(deposit.amount);
    if (isNaN(depAmount) || depAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid deposit amount' }, { status: 400 });
    }

    if (deposit.status === 'Pending' && status === 'Approved') {
      deposit.status = 'Approved';
      await deposit.save();

      const user = await User.findById(deposit.userId);
      if (user) {
        user.balance += depAmount;
        user.totalDeposit += depAmount;
        await user.save();

        const cleanRefCode = sanitizeReferralCode(user.referredBy);

        // Credit 1-Time Level 1 (6%) & Level 2 (3%) Referral Deposit Bonuses per player
        if (!user.hasCreditedReferralBonus && cleanRefCode) {
          const referrerL1 = await User.findOne({
            referralCode: { $regex: new RegExp('^' + cleanRefCode + '$', 'i') }
          });

          if (referrerL1) {
            const level1Bonus = Math.round(depAmount * 0.06);
            if (level1Bonus > 0) {
              referrerL1.balance += level1Bonus;
              referrerL1.totalProfit += level1Bonus; // Added to totalProfit so it can be withdrawn
              await referrerL1.save();
            }

            const cleanL2RefCode = sanitizeReferralCode(referrerL1.referredBy);
            if (cleanL2RefCode) {
              const referrerL2 = await User.findOne({
                referralCode: { $regex: new RegExp('^' + cleanL2RefCode + '$', 'i') }
              });

              if (referrerL2) {
                const level2Bonus = Math.round(depAmount * 0.03);
                if (level2Bonus > 0) {
                  referrerL2.balance += level2Bonus;
                  referrerL2.totalProfit += level2Bonus; // Added to totalProfit so it can be withdrawn
                  await referrerL2.save();
                }
              }
            }
          }

          // Mark user as having received 1-time referral bonus so subsequent deposits do not trigger bonuses
          user.hasCreditedReferralBonus = true;
          await user.save();
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
