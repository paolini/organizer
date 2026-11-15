import { NextResponse } from 'next/server';
import { authorize, hasPermission } from '../_lib/auth';
import { listTrash, retentionDays } from '../_lib/trash';

// Contenuto del cestino (permesso write: chi può eliminare può anche ripristinare)
export async function GET(req: Request) {
  const user = await authorize(req, 'write');
  if (user instanceof NextResponse) return user;
  const rootDir = process.env.TARGET_DIR || '';
  if (!rootDir) return NextResponse.json({ error: 'Variabile TARGET_DIR non impostata' }, { status: 500 });
  return NextResponse.json({
    entries: await listTrash(rootDir),
    retentionDays: retentionDays(),
    canPurge: hasPermission(user, 'admin'),
  });
}
