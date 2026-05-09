import { NextResponse } from 'next/server';
import { getAll, run } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { login, password, name } = body;

    if (!login || !password || !name) {
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
    await run`INSERT INTO users (username, phone, password_hash, name, role, status, permissions) VALUES (${username}, ${phone}, ${passwordHash}, ${name}, 'user', 'pending', NULL)`;

    return NextResponse.json({
      message: 'Registration successful, please wait for admin approval'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
