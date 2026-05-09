import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const user = await getOne`SELECT id, username, phone, name, role, status, permissions, created_at FROM users WHERE id = ${parseInt(id)}`;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}

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
    const { name, username, phone } = body;

    // Check if user exists
    const existing = await getOne`SELECT id FROM users WHERE id = ${parseInt(id)}`;
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check uniqueness if username or phone is being changed
    if (username) {
      const conflict = await getOne`SELECT id FROM users WHERE username = ${username} AND id != ${parseInt(id)}`;
      if (conflict) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
      }
    }

    if (phone) {
      const conflict = await getOne`SELECT id FROM users WHERE phone = ${phone} AND id != ${parseInt(id)}`;
      if (conflict) {
        return NextResponse.json({ error: 'Phone already exists' }, { status: 400 });
      }
    }

    // Get current values
    const current = await getOne`SELECT name, username, phone FROM users WHERE id = ${parseInt(id)}` as any;

    await run`UPDATE users SET name = ${name || current.name}, username = ${username || current.username}, phone = ${phone || current.phone}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if user exists
    const existing = await getOne`SELECT id, role FROM users WHERE id = ${parseInt(id)}` as any;

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cannot delete admin
    if (existing.role === 'admin') {
      return NextResponse.json({ error: 'Cannot delete admin user' }, { status: 400 });
    }

    await run`DELETE FROM users WHERE id = ${parseInt(id)}`;

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
