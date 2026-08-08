import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = url.origin;
  return NextResponse.redirect(`${host}/7star-admin.apk`);
}
