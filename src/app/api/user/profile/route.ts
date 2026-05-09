import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const user = await getOne`SELECT id, username, phone, name, role, status, permissions, created_at FROM users WHERE id = ${parseInt(userId)}` as any;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        name: user.name,
        role: user.role,
        status: user.status,
        permissions: user.permissions ? JSON.parse(user.permissions) : null,
        created_at: user.created_at,
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { name, password } = body;

    if (!name && !password) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await getOne`SELECT id FROM users WHERE id = ${parseInt(userId)}`;
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update fields
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await run`UPDATE users SET name = COALESCE(${name || null}, name), password_hash = ${passwordHash}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(userId)}`;
    } else {
      await run`UPDATE users SET name = ${name}, updated_at = CURRENT_TIMESTAMP WHERE id = ${parseInt(userId)}`;
    }

    return NextResponse.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
