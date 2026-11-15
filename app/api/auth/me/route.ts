import { NextResponse } from 'next/server';
import { getUserFromReq, publicUser } from '../../_lib/auth';

export async function GET(req: Request) {
  const user = await getUserFromReq(req);
  return NextResponse.json({ user: user ? publicUser(user) : null });
}
