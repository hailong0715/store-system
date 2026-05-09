import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// POST /api/stock-in - 批量入库
export async function POST(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permissions = (session.user as any)?.permissions;
    if (permissions && !permissions.canIn) {
      return NextResponse.json({ error: '您没有入库权限' }, { status: 403 });
    }

    const body = await request.json();
    const { items, rows } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const batchId = uuidv4(); // 生成批次号
    const results: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = rows?.[i];

      const { itemId, quantity, conditionId } = item;

      if (!itemId || !quantity || quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid item ID or quantity: ${itemId}` },
          { status: 400 }
        );
      }

      if (!conditionId) {
        return NextResponse.json(
          { error: `Please select product condition for: ${itemId}` },
          { status: 400 }
        );
      }

      const operatorName = row?.operatorName || (session.user as any).name || '';
      const remark = row?.remark || '';

      if (!operatorName.trim()) {
        return NextResponse.json(
          { error: 'Operator name is required' },
          { status: 400 }
        );
      }

      // Get the base item info (to get name, category_id, etc.)
      const baseItem = await getOne`SELECT * FROM stock_items WHERE id = ${itemId} AND is_deleted = 0` as any;
      if (!baseItem) {
        return NextResponse.json({ error: `Item not found: ${itemId}` }, { status: 404 });
      }

      // Try to find existing stock item with same name and condition
      let stockItem = await getOne`
        SELECT * FROM stock_items
        WHERE name = ${baseItem.name} AND condition_id = ${conditionId} AND is_deleted = 0
      ` as any;

      let quantityBefore: number;
      let quantityAfter: number;
      let currentItemId: number;

      if (stockItem) {
        // Update existing stock
        currentItemId = stockItem.id;
        quantityBefore = stockItem.quantity;
        quantityAfter = quantityBefore + parseInt(quantity);
        await run`UPDATE stock_items SET quantity = ${quantityAfter}, updated_at = CURRENT_TIMESTAMP WHERE id = ${currentItemId}`;
      } else {
        // Create new stock item with the same name but different condition
        const newSku = `${baseItem.sku}-${conditionId}`;
        const newItemResult = await run`
          INSERT INTO stock_items (sku, name, category_id, condition_id, quantity, unit, location, description)
          VALUES (${newSku}, ${baseItem.name}, ${baseItem.category_id}, ${conditionId}, ${parseInt(quantity)}, ${baseItem.unit}, ${baseItem.location}, ${baseItem.description})
          RETURNING id
        `;
        currentItemId = newItemResult[0].id;
        quantityBefore = 0;
        quantityAfter = parseInt(quantity);
        stockItem = { name: baseItem.name };
      }

      // Create stock log with batch_id and condition_id
      await run`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, batch_id, condition_id)
        VALUES (${currentItemId}, 'in', ${parseInt(quantity)}, ${quantityBefore}, ${quantityAfter}, ${userId}, ${operatorName}, ${remark || '批量入库'}, ${batchId}, ${conditionId})
      `;

      results.push({
        itemId: currentItemId,
        name: baseItem.name,
        quantityBefore,
        quantityAfter,
        conditionId,
        operatorName,
      });
    }

    return NextResponse.json({
      success: true,
      batchId,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('Error in batch stock in:', error);
    return NextResponse.json({ error: 'Failed to stock in' }, { status: 500 });
  }
}
