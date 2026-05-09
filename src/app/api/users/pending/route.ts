import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await getAll`SELECT id, username, phone, name, role, status, created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC`;

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get pending users error:', error);
    return NextResponse.json({ error: 'Failed to get pending users' }, { status: 500 });
  }
}
