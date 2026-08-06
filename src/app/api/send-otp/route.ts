import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import Otp from '@/models/Otp';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'amjadrana6881@gmail.com',
    pass: process.env.EMAIL_PASS || 'kscxqlxosezjjlrt'
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000
});

export async function POST(req: Request) {
  try {
    const { email, type } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    await connectToDatabase();

    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, message: 'Invalid email address format' }, { status: 400 });
    }

    // Check if user already exists (for signup)
    if (type === 'signup') {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return NextResponse.json({ success: false, message: 'Email already registered' }, { status: 400 });
      }
    } else if (type === 'forgot') {
      // Check if user exists (for forgot password)
      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        return NextResponse.json({ success: false, message: 'Email address not found' }, { status: 404 });
      }
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any old OTP for this email
    await Otp.deleteMany({ email });

    // Store new OTP
    await Otp.create({
      email,
      otp: otpCode
    });

    // Send Email
    const mailOptions = {
      from: `"7 STAR INVEST" <${process.env.EMAIL_USER || 'amjadrana6881@gmail.com'}>`,
      to: email,
      subject: '7 STAR INVEST - Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #fde68a; border-radius: 12px; background-color: #fffbeb;">
          <h2 style="color: #d97706; text-align: center;">7 STAR INVEST</h2>
          <p style="color: #475569; font-size: 16px;">Hello,</p>
          <p style="color: #475569; font-size: 16px;">Your verification OTP code is:</p>
          <div style="background-color: #ffffff; border: 2px solid #d97706; border-radius: 8px; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #d97706; margin: 20px 0;">
            ${otpCode}
          </div>
          <p style="color: #64748b; font-size: 14px; text-align: center;">This code is valid for 10 minutes. Please do not share it with anyone.</p>
          <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">© 2026 7 STAR INVEST. All rights reserved.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: 'Verification OTP sent to your email successfully!' });
  } catch (err: any) {
    console.error('Send OTP error:', err);
    return NextResponse.json({ success: false, message: 'Failed to send OTP email: ' + err.message }, { status: 500 });
  }
}
