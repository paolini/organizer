import { NextResponse } from 'next/server';
import { getUserFromReq } from '../../_lib/auth';

export async function GET(req: Request) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.id, username: user.username, permissions: user.permissions || [] } });
}
