import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

// GET /api/stock-items/[id] - 获取单个商品
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const item = await getOne`
      SELECT si.*, c.name as category_name, pc.name as condition_name
      FROM stock_items si
      LEFT JOIN categories c ON si.category_id = c.id
      LEFT JOIN product_conditions pc ON si.condition_id = pc.id
      WHERE si.id = ${id} AND si.is_deleted = 0
    `;

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error fetching stock item:', error);
    return NextResponse.json({ error: 'Failed to fetch stock item' }, { status: 500 });
  }
}

// PUT /api/stock-items/[id] - 编辑商品
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
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

    // Check if item exists
    const existing = await getOne`SELECT * FROM stock_items WHERE id = ${id} AND is_deleted = 0`;
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check if SKU is used by another item
    const skuUsed = await getOne`SELECT id FROM stock_items WHERE sku = ${sku} AND id != ${id} AND is_deleted = 0`;
    if (skuUsed) {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 400 });
    }

    await run`
      UPDATE stock_items
      SET sku = ${sku}, name = ${name}, category_id = ${category_id || null}, condition_id = ${condition_id || null}, quantity = ${quantity || 0}, unit = ${unit || null}, location = ${location || null}, description = ${description || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    const updated = await getOne`
      SELECT si.*, c.name as category_name, pc.name as condition_name
      FROM stock_items si
      LEFT JOIN categories c ON si.category_id = c.id
      LEFT JOIN product_conditions pc ON si.condition_id = pc.id
      WHERE si.id = ${id}
    `;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating stock item:', error);
    return NextResponse.json({ error: 'Failed to update stock item' }, { status: 500 });
  }
}

// DELETE /api/stock-items/[id] - 删除商品（软删除）
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const existing = await getOne`SELECT * FROM stock_items WHERE id = ${id} AND is_deleted = 0`;

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Soft delete
    await run`UPDATE stock_items SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting stock item:', error);
    return NextResponse.json({ error: 'Failed to delete stock item' }, { status: 500 });
  }
}
