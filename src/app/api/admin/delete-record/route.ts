import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Deposit from '@/models/Deposit';
import Withdrawal from '@/models/Withdrawal';
import UserPlan from '@/models/UserPlan';
import { verifyAdminHeader } from '@/lib/authAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ success: false, message: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const { type, id } = await req.json();

    if (!type || !id) {
      return NextResponse.json({ success: false, message: 'Missing type or record ID' }, { status: 400 });
    }

    await connectToDatabase();

    if (type === 'deposit') {
      await Deposit.findByIdAndDelete(id);
    } else if (type === 'withdrawal') {
      await Withdrawal.findByIdAndDelete(id);
    } else if (type === 'userPlan') {
      await UserPlan.findByIdAndDelete(id);
    } else {
      return NextResponse.json({ success: false, message: 'Invalid record type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Record deleted successfully.`
    });
  } catch (err: any) {
    console.error('Delete record error:', err);
    return NextResponse.json({ success: false, message: 'Server error deleting record' }, { status: 500 });
  }
}
