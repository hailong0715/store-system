import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAll, run } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let users;

    if (status) {
      users = await getAll`SELECT id, username, phone, name, role, status, permissions, created_at FROM users WHERE status = ${status} ORDER BY created_at DESC`;
    } else {
      users = await getAll`SELECT id, username, phone, name, role, status, permissions, created_at FROM users ORDER BY created_at DESC`;
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { login, password, name, permissions } = body;

    if (!login || !password || !name || !permissions) {
      return NextResponse.json(
        { error: 'Please fill in all required fields' },
        { status: 400 }
      );
    }

    // Determine if login is username or phone
    const isPhone = /^\d+$/.test(login);
    const username = isPhone ? null : login;
    const phone = isPhone ? login : null;

    // Check uniqueness
    if (username) {
      const existing = await getAll`SELECT id FROM users WHERE username = ${username}`;
      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        );
      }
    }

    if (phone) {
      const existing = await getAll`SELECT id FROM users WHERE phone = ${phone}`;
      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'Phone number already exists' },
          { status: 400 }
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    await run`INSERT INTO users (username, phone, password_hash, name, role, status, permissions) VALUES (${username}, ${phone}, ${passwordHash}, ${name}, 'user', 'approved', ${JSON.stringify(permissions)})`;

    return NextResponse.json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
