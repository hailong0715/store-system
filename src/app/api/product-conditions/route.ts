import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

// GET /api/product-conditions - 获取产品属性列表
export async function GET() {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conditions = await getAll`SELECT * FROM product_conditions ORDER BY id DESC`;
    return NextResponse.json(conditions);
  } catch (error) {
    console.error('Error fetching product conditions:', error);
    return NextResponse.json({ error: 'Failed to fetch product conditions' }, { status: 500 });
  }
}

// POST /api/product-conditions - 新建产品属性
export async function POST(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Condition name is required' }, { status: 400 });
    }

    const result = await run`INSERT INTO product_conditions (name, description) VALUES (${name}, ${description || null}) RETURNING id`;

    const newId = result[0].id;
    const newCondition = await getOne`SELECT * FROM product_conditions WHERE id = ${newId}`;

    return NextResponse.json(newCondition, { status: 201 });
  } catch (error) {
    console.error('Error creating product condition:', error);
    return NextResponse.json({ error: 'Failed to create product condition' }, { status: 500 });
  }
}
