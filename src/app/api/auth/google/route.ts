import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { sanitizeReferralCode, generateUniqueReferralCode, buildStandardUserPayload } from '@/lib/referral';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
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
          const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(Buffer.from(base64Url, 'base64').toString('utf-8'));
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
      const referralCode = await generateUniqueReferralCode();

      let validReferrerCode = null;
      const cleanRef = sanitizeReferralCode(refCode);
      if (cleanRef) {
        const referrer = await User.findOne({
          referralCode: { $regex: new RegExp('^' + cleanRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
        });
        if (referrer) {
          validReferrerCode = referrer.referralCode;
        }
      }

      const defaultPasswordHash = await bcrypt.hash('google_auth_user_' + Date.now() + '_' + Math.random(), 10);

      // Drop non-sparse legacy phone_1 index if present in MongoDB Atlas
      try {
        await User.collection.dropIndex('phone_1');
      } catch (e) {
        // Ignore if index doesn't exist
      }

      user = await User.create({
        username,
        email: targetEmail,
        passwordHash: defaultPasswordHash,
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
      // Update Google ID, Avatar or Referral Code if missing
      let updated = false;
      if (!user.googleId && targetGoogleId) {
        user.googleId = targetGoogleId;
        updated = true;
      }
      if (targetPicture && user.avatar !== targetPicture) {
        user.avatar = targetPicture;
        updated = true;
      }
      if (!user.referralCode) {
        user.referralCode = await generateUniqueReferralCode();
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, userId: user._id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const responseData = {
      success: true,
      message: 'Google login successful!',
      token,
      user: buildStandardUserPayload(user)
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
