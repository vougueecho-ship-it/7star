import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import OAuthTicket from '@/models/OAuthTicket';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await connectToDatabase();
    const mode = String(body.mode || '').trim();

    // 1. App creates a pending session ticket, then polls until Google completes in the browser
    if (mode === 'session') {
      const sid = crypto.randomBytes(24).toString('hex');
      await OAuthTicket.create({
        sid,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });
      return NextResponse.json({ success: true, sid });
    }

    // 2. Callback page marks the session ready after Google OAuth succeeds
    if (mode === 'complete') {
      const sid = String(body.sid || '').trim();
      const user = body.user;
      const token = body.token;
      if (!sid || !user?.email) {
        return NextResponse.json({ success: false, message: 'Session and user are required.' }, { status: 400 });
      }

      const result = await OAuthTicket.updateOne(
        { sid, status: 'pending', expiresAt: { $gt: new Date() } },
        {
          $set: {
            status: 'ready',
            user,
            token,
            isNewUser: Boolean(body.isNewUser),
            completedAt: new Date()
          }
        }
      );

      if (!result.matchedCount) {
        return NextResponse.json({ success: false, message: 'Login session expired or invalid.' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    // 3. One-shot ticket
    const user = body.user;
    const token = body.token;
    if (!user?.email) {
      return NextResponse.json({ success: false, message: 'User is required.' }, { status: 400 });
    }

    const ticket = crypto.randomBytes(24).toString('hex');
    await OAuthTicket.create({
      ticket,
      status: 'ready',
      user,
      token,
      isNewUser: Boolean(body.isNewUser),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error('Create Google ticket error:', error);
    return NextResponse.json({ success: false, message: 'Could not create login ticket.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sid = String(url.searchParams.get('sid') || '').trim();
    const ticket = String(url.searchParams.get('ticket') || '').trim();
    await connectToDatabase();

    if (sid) {
      const doc = await OAuthTicket.findOne({
        sid,
        expiresAt: { $gt: new Date() }
      });

      if (!doc) {
        return NextResponse.json({ success: false, status: 'expired', message: 'Login session expired.' }, { status: 404 });
      }

      if (doc.status === 'pending') {
        return NextResponse.json({ success: true, status: 'pending' });
      }

      if (doc.status === 'ready' && doc.user) {
        await OAuthTicket.deleteOne({ _id: doc._id });
        return NextResponse.json({
          success: true,
          status: 'ready',
          token: doc.token,
          user: doc.user,
          isNewUser: Boolean(doc.isNewUser)
        });
      }

      return NextResponse.json({ success: true, status: doc.status || 'pending' });
    }

    if (!ticket) {
      return NextResponse.json({ success: false, message: 'Ticket or session id is required.' }, { status: 400 });
    }

    const doc = await OAuthTicket.findOneAndDelete({
      ticket,
      expiresAt: { $gt: new Date() }
    });

    if (!doc?.user) {
      return NextResponse.json({ success: false, message: 'Login ticket expired or invalid.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      token: doc.token,
      user: doc.user,
      isNewUser: Boolean(doc.isNewUser)
    });
  } catch (error: any) {
    console.error('Redeem Google ticket error:', error);
    return NextResponse.json({ success: false, message: 'Could not redeem login ticket.' }, { status: 500 });
  }
}
