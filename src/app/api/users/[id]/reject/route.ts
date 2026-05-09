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

    // Delete user
    await run`DELETE FROM users WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ message: 'User rejected and deleted' });
  } catch (error) {
    console.error('Reject user error:', error);
    return NextResponse.json({ error: 'Failed to reject user' }, { status: 500 });
  }
}
