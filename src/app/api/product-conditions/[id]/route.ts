import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

// PUT /api/product-conditions/[id] - 编辑产品属性
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
      return NextResponse.json({ error: 'Invalid condition ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Condition name is required' }, { status: 400 });
    }

    const existing = await getOne`SELECT * FROM product_conditions WHERE id = ${id}`;

    if (!existing) {
      return NextResponse.json({ error: 'Condition not found' }, { status: 404 });
    }

    await run`UPDATE product_conditions SET name = ${name}, description = ${description || null} WHERE id = ${id}`;

    const updated = await getOne`SELECT * FROM product_conditions WHERE id = ${id}`;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating product condition:', error);
    return NextResponse.json({ error: 'Failed to update product condition' }, { status: 500 });
  }
}

// DELETE /api/product-conditions/[id] - 删除产品属性
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
      return NextResponse.json({ error: 'Invalid condition ID' }, { status: 400 });
    }

    const existing = await getOne`SELECT * FROM product_conditions WHERE id = ${id}`;

    if (!existing) {
      return NextResponse.json({ error: 'Condition not found' }, { status: 404 });
    }

    // Check if condition is used by any stock item
    const inUse = await getOne`SELECT COUNT(*) as count FROM stock_items WHERE condition_id = ${id}` as { count: number };

    if (inUse.count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete condition that is in use by stock items' },
        { status: 400 }
      );
    }

    await run`DELETE FROM product_conditions WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product condition:', error);
    return NextResponse.json({ error: 'Failed to delete product condition' }, { status: 500 });
  }
}
