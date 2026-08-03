import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Withdrawal from '@/models/Withdrawal';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const { withdrawalId, status } = await req.json();

    await connectToDatabase();

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return NextResponse.json({ success: false, message: 'Withdrawal not found' }, { status: 404 });
    }

    if (withdrawal.status === 'Pending') {
      withdrawal.status = status;
      await withdrawal.save();

      const user = await User.findById(withdrawal.userId);
      if (user) {
        if (status === 'Approved') {
          user.totalWithdraw += withdrawal.amount;
          await user.save();
        } else if (status === 'Rejected') {
          user.balance += withdrawal.amount;
          await user.save();
        }
      }
    }

    return NextResponse.json({ success: true, message: `Withdrawal ${status}!` });
  } catch (err: any) {
    console.error('Withdrawal status error:', err);
    return NextResponse.json({ success: false, message: 'Error updating withdrawal status' }, { status: 500 });
  }
}
