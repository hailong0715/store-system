import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId } from '@/lib/db';

export async function PUT(
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

    // Check if user exists
    const existing = await getOne`SELECT id FROM users WHERE id = ${parseInt(id)}`;
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await run`UPDATE users SET permissions = ${JSON.stringify(permissions)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Update permissions error:', error);
    return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
  }
}
