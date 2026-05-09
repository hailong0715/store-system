import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permissions = (session.user as any)?.permissions;
    if (!permissions?.canOut) {
      return NextResponse.json({ error: 'No permission to stock out' }, { status: 403 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const body = await request.json();
    const { quantity, remark } = body;

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    // Get current item
    const item = await getOne`SELECT * FROM stock_items WHERE id = ${id} AND is_deleted = 0` as any;
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const quantityBefore = item.quantity;
    const quantityAfter = quantityBefore - parseInt(quantity);

    if (quantityAfter < 0) {
      return NextResponse.json({ error: 'Insufficient stock quantity' }, { status: 400 });
    }

    // Update stock quantity
    await run`UPDATE stock_items SET quantity = ${quantityAfter}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;

    // Create stock log
    await run`
      INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark)
      VALUES (${id}, 'out', ${-parseInt(quantity)}, ${quantityBefore}, ${quantityAfter}, ${(session.user as any).id}, ${(session.user as any).name || session.user?.name}, ${remark || null})
    `;

    const updatedItem = await getOne`
      SELECT si.*, c.name as category_name, pc.name as condition_name
      FROM stock_items si
      LEFT JOIN categories c ON si.category_id = c.id
      LEFT JOIN product_conditions pc ON si.condition_id = pc.id
      WHERE si.id = ${id}
    `;

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error in stock out:', error);
    return NextResponse.json({ error: 'Failed to stock out' }, { status: 500 });
  }
}
