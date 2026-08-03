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
