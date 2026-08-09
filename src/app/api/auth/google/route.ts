import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret7starjwtkey987654321';

export async function POST(req: Request) {
  try {
    const { googleId, email, name, picture, credential, refCode } = await req.json();

    if (!googleId && !email && !credential) {
      return NextResponse.json({ success: false, message: 'Google authentication details missing' }, { status: 400 });
    }

    await connectToDatabase();

    let targetEmail = email;
    let targetGoogleId = googleId;
    let targetName = name;
    let targetPicture = picture;

    // Decode JWT credential if sent directly from Google GSI
    if (credential && (!targetEmail || !targetGoogleId)) {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          targetEmail = payload.email || targetEmail;
          targetGoogleId = payload.sub || targetGoogleId;
          targetName = payload.name || targetName;
          targetPicture = payload.picture || targetPicture;
        }
      } catch (e) {
        console.error('Error parsing Google credential JWT:', e);
      }
    }

    if (!targetEmail && !targetGoogleId) {
      return NextResponse.json({ success: false, message: 'Unable to extract Google account email' }, { status: 400 });
    }

    // Check if user exists by googleId or email
    let user = null;
    if (targetGoogleId) {
      user = await User.findOne({ googleId: targetGoogleId });
    }
    if (!user && targetEmail) {
      user = await User.findOne({ email: targetEmail });
    }

    // If user does not exist, register new account automatically
    if (!user) {
      // Generate clean unique username
      let baseUsername = (targetName || targetEmail.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      if (baseUsername.length < 3) baseUsername = 'user';

      let username = baseUsername;
      let counter = 1;
      while (await User.findOne({ username })) {
        username = `${baseUsername}${Math.floor(100 + Math.random() * 900)}${counter}`;
        counter++;
      }

      // Generate unique referral code
      const referralCode = 'STAR' + Math.floor(100000 + Math.random() * 900000);

      // Verify referrer if provided
      let validReferrerCode = null;
      if (refCode) {
        const referrer = await User.findOne({ referralCode: refCode });
        if (referrer) {
          validReferrerCode = refCode;
        }
      }

      user = await User.create({
        username,
        email: targetEmail,
        googleId: targetGoogleId,
        avatar: targetPicture,
        balance: 0,
        totalDeposit: 0,
        totalWithdraw: 0,
        totalProfit: 0,
        referralCode,
        referredBy: validReferrerCode
      });
    } else {
      // Update Google ID and Avatar if not linked yet
      let updated = false;
      if (!user.googleId && targetGoogleId) {
        user.googleId = targetGoogleId;
        updated = true;
      }
      if (targetPicture && user.avatar !== targetPicture) {
        user.avatar = targetPicture;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const responseData = {
      success: true,
      message: 'Google login successful!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone || '',
        avatar: user.avatar || '',
        balance: user.balance || 0,
        totalDeposit: user.totalDeposit || 0,
        totalWithdraw: user.totalWithdraw || 0,
        totalProfit: user.totalProfit || 0,
        referralCode: user.referralCode,
        referredBy: user.referredBy || null
      }
    };

    const res = NextResponse.json(responseData);

    // Set HTTP-only auth cookie for session persistence
    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/'
    });

    return res;
  } catch (err: any) {
    console.error('Google Auth Route Error:', err);
    return NextResponse.json({ success: false, message: 'Google authentication error: ' + (err.message || 'Server error') }, { status: 500 });
  }
}
