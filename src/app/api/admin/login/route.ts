import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret7starjwtkey987654321';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin@7starinvest';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '7starsecretadmin2026';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
      return NextResponse.json({ success: true, message: 'Admin authenticated!', token });
    }

    return NextResponse.json({ success: false, message: 'Invalid Admin credentials' }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Admin login error' }, { status: 500 });
  }
}
