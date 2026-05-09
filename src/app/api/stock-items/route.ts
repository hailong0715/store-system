import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

// GET /api/stock-items - 获取商品列表
export async function GET(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const conditionId = searchParams.get('conditionId');
    const search = searchParams.get('search');

    let query = `
      SELECT
        si.*,
        c.name as category_name,
        pc.name as condition_name
      FROM stock_items si
      LEFT JOIN categories c ON si.category_id = c.id
      LEFT JOIN product_conditions pc ON si.condition_id = pc.id
      WHERE si.is_deleted = 0
    `;

    if (categoryId) {
      query += ` AND si.category_id = ${parseInt(categoryId)}`;
    }

    if (conditionId) {
      query += ` AND si.condition_id = ${parseInt(conditionId)}`;
    }

    if (search) {
      query += ` AND (si.name LIKE '%${search}%' OR si.sku LIKE '%${search}%')`;
    }

    query += ' ORDER BY si.id DESC';

    const items = await getAll`${query}`;

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching stock items:', error);
    return NextResponse.json({ error: 'Failed to fetch stock items' }, { status: 500 });
  }
}

// POST /api/stock-items - 新建商品
export async function POST(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      sku,
      name,
      category_id,
      condition_id,
      quantity,
      unit,
      location,
      description
    } = body;

    if (!sku || !name) {
      return NextResponse.json({ error: 'SKU and name are required' }, { status: 400 });
    }

    // Check if SKU already exists (including soft-deleted items)
    const existing = await getOne`SELECT id, is_deleted FROM stock_items WHERE sku = ${sku}`;
    if (existing) {
      if ((existing as any).is_deleted === 1) {
        return NextResponse.json({ error: '该SKU已被使用，但对应的商品已被删除。请使用其他SKU或联系管理员。' }, { status: 400 });
      }
      return NextResponse.json({ error: 'SKU already exists' }, { status: 400 });
    }

    const result = await run`
      INSERT INTO stock_items (sku, name, category_id, condition_id, quantity, unit, location, description)
      VALUES (${sku}, ${name}, ${category_id || null}, ${condition_id || null}, ${quantity || 0}, ${unit || null}, ${location || null}, ${description || null})
      RETURNING id
    `;

    const newId = result[0].id;
    const newItem = await getOne`
      SELECT si.*, c.name as category_name, pc.name as condition_name
      FROM stock_items si
      LEFT JOIN categories c ON si.category_id = c.id
      LEFT JOIN product_conditions pc ON si.condition_id = pc.id
      WHERE si.id = ${newId}
    `;

    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error('Error creating stock item:', error);
    return NextResponse.json({ error: 'Failed to create stock item' }, { status: 500 });
  }
}
