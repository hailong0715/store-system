import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// POST /api/stock-out - 批量出库
export async function POST(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permissions = (session.user as any)?.permissions;
    if (permissions && !permissions.canOut) {
      return NextResponse.json({ error: '您没有出库权限' }, { status: 403 });
    }

    const body = await request.json();
    const { items, rows } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '请提供出库商品列表' }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const batchId = uuidv4();
    const results: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = rows?.[i];

      const { itemId, quantity, conditionId } = item;

      if (!itemId || !quantity || quantity <= 0) {
        return NextResponse.json({ error: `无效的商品或数量: ${itemId}` }, { status: 400 });
      }

      const operatorName = row?.operatorName || (session.user as any).name || '';
      const remark = row?.remark || '';

      if (!operatorName.trim()) {
        return NextResponse.json({ error: '请填写出库人员' }, { status: 400 });
      }

      // 获取当前商品库存
      const stockItem = await getOne`SELECT * FROM stock_items WHERE id = ${itemId} AND is_deleted = 0` as any;
      if (!stockItem) {
        return NextResponse.json({ error: `商品不存在: ${itemId}` }, { status: 404 });
      }

      const quantityBefore = stockItem.quantity;
      const quantityAfter = quantityBefore - parseInt(quantity);

      // 检查库存是否足够
      if (quantityAfter < 0) {
        return NextResponse.json({
          error: `库存不足: ${stockItem.name}，当前库存 ${quantityBefore}，出库数量 ${quantity}`
        }, { status: 400 });
      }

      // 更新库存（如果选择了新属性则更新属性）
      if (conditionId) {
        await run`UPDATE stock_items SET quantity = ${quantityAfter}, condition_id = ${conditionId}, updated_at = CURRENT_TIMESTAMP WHERE id = ${itemId}`;
      } else {
        await run`UPDATE stock_items SET quantity = ${quantityAfter}, updated_at = CURRENT_TIMESTAMP WHERE id = ${itemId}`;
      }

      // 创建出库日志
      await run`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, batch_id, condition_id)
        VALUES (${itemId}, 'out', ${-parseInt(quantity)}, ${quantityBefore}, ${quantityAfter}, ${userId}, ${operatorName}, ${remark || '批量出库'}, ${batchId}, ${conditionId || null})
      `;

      results.push({
        itemId,
        name: stockItem.name,
        quantityBefore,
        quantityAfter,
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
    console.error('Error in batch stock out:', error);
    return NextResponse.json({ error: '出库失败' }, { status: 500 });
  }
}
