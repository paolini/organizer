import { NextResponse } from 'next/server';
import { sessionCookie } from '../../_lib/auth';

export async function POST() {
  return NextResponse.json({ success: true }, { headers: { 'Set-Cookie': sessionCookie(null) } });
}
