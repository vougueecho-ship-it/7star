import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
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
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Cascade delete user data
    await User.findByIdAndDelete(userId);
    await Deposit.deleteMany({ userId });
    await Withdrawal.deleteMany({ userId });
    await UserPlan.deleteMany({ userId });

    return NextResponse.json({
      success: true,
      message: `User ${user.username} (${user.phone}) and all associated records deleted successfully.`
    });
  } catch (err: any) {
    console.error('Delete user error:', err);
    return NextResponse.json({ success: false, message: 'Server error deleting user' }, { status: 500 });
  }
}
