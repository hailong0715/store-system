import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get current user status
    const existing = await getOne`SELECT id, status, role FROM users WHERE id = ${parseInt(id)}` as any;

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.role === 'admin') {
      return NextResponse.json({ error: 'Cannot disable admin user' }, { status: 400 });
    }

    // Toggle status
    const newStatus = existing.status === 'disabled' ? 'approved' : 'disabled';

    await run`UPDATE users SET status = ${newStatus}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ message: `User ${newStatus === 'disabled' ? 'disabled' : 'enabled'} successfully` });
  } catch (error) {
    console.error('Disable user error:', error);
    return NextResponse.json({ error: 'Failed to disable user' }, { status: 500 });
  }
}
