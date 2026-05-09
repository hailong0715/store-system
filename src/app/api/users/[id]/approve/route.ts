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
    const body = await request.json();
    const { permissions } = body;

    if (!permissions) {
      return NextResponse.json(
        { error: 'Permissions are required' },
        { status: 400 }
      );
    }

    // Check if user exists and is pending
    const existing = await getOne`SELECT id, status FROM users WHERE id = ${parseInt(id)}` as any;

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'User is not pending approval' },
        { status: 400 }
      );
    }

    await run`UPDATE users SET status = 'approved', permissions = ${JSON.stringify(permissions)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ message: 'User approved successfully' });
  } catch (error) {
    console.error('Approve user error:', error);
    return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 });
  }
}
