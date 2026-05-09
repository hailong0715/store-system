import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

// GET /api/stock-in/history/[batchId] - 获取指定批次详情
export async function GET(
  request: Request,
  { params }: { params: { batchId: string } }
) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId } = params;

    // 获取批次信息
    const batchInfo = await getOne`
      SELECT DISTINCT
        sl.batch_id,
        sl.operator_name,
        sl.created_at,
        sl.is_revised
      FROM stock_logs sl
      WHERE sl.batch_id = ${batchId}
    ` as any;

    if (!batchInfo) {
      return NextResponse.json({ error: '批次不存在' }, { status: 404 });
    }

    // 获取批次中的所有商品
    const items = await getAll`
      SELECT
        sl.id as log_id,
        sl.item_id,
        sl.quantity_change,
        sl.quantity_before,
        sl.quantity_after,
        sl.condition_id,
        sl.operator_name,
        sl.remark,
        si.sku,
        si.name as item_name,
        si.category_id,
        c.name as category_name,
        pc.name as condition_name
      FROM stock_logs sl
      LEFT JOIN stock_items si ON sl.item_id = si.id
      LEFT JOIN categories c ON si.category_id = c.id
      LEFT JOIN product_conditions pc ON sl.condition_id = pc.id
      WHERE sl.batch_id = ${batchId}
    `;

    return NextResponse.json({
      batchId: batchInfo.batch_id,
      operatorName: batchInfo.operator_name,
      createdAt: batchInfo.created_at,
      isRevised: batchInfo.is_revised,
      items,
    });
  } catch (error) {
    console.error('Error fetching batch details:', error);
    return NextResponse.json({ error: 'Failed to fetch batch details' }, { status: 500 });
  }
}

// PUT /api/stock-in/history/[batchId] - 重新入库（整批更新）
export async function PUT(
  request: Request,
  { params }: { params: { batchId: string } }
) {
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

    const { batchId } = params;
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '请提供入库商品列表' }, { status: 400 });
    }

    const userId = (session.user as any).id;

    // 获取原批次记录
    const oldLogs = await getAll`
      SELECT * FROM stock_logs WHERE batch_id = ${batchId} AND operation_type = 'in'
    ` as any[];

    if (oldLogs.length === 0) {
      return NextResponse.json({ error: '批次不存在' }, { status: 404 });
    }

    if (oldLogs[0].is_revised) {
      return NextResponse.json({ error: '该批次已被修订，不能再次修订' }, { status: 400 });
    }

    const results: any[] = [];

    // 遍历新 items，计算库存变化
    for (const newItem of items) {
      const { itemId, quantity, conditionId, operatorName, remark } = newItem;

      if (!itemId || !quantity || quantity <= 0) {
        return NextResponse.json({ error: `无效的商品或数量: ${itemId}` }, { status: 400 });
      }

      if (!conditionId) {
        return NextResponse.json({ error: `请选择商品属性: ${itemId}` }, { status: 400 });
      }

      // 查找原记录中的对应商品
      const oldLog = oldLogs.find((l) => l.item_id === itemId);
      const oldQuantity = oldLog ? oldLog.quantity_change : 0;

      // 获取商品当前库存
      const stockItem = await getOne`SELECT * FROM stock_items WHERE id = ${itemId} AND is_deleted = 0` as any;
      if (!stockItem) {
        return NextResponse.json({ error: `商品不存在: ${itemId}` }, { status: 404 });
      }

      // 计算库存差额
      const quantityBefore = stockItem.quantity;
      const diff = quantity - oldQuantity;
      const quantityAfter = quantityBefore + diff;

      if (quantityAfter < 0) {
        return NextResponse.json({ error: `库存不足，无法减少这么多: ${stockItem.name}` }, { status: 400 });
      }

      // 更新商品库存
      await run`UPDATE stock_items SET quantity = ${quantityAfter}, condition_id = ${conditionId}, updated_at = CURRENT_TIMESTAMP WHERE id = ${itemId}`;

      results.push({
        itemId,
        name: stockItem.name,
        oldQuantity,
        newQuantity: quantity,
        quantityBefore,
        quantityAfter,
      });
    }

    // 将原批次标记为已修订
    await run`UPDATE stock_logs SET is_revised = 1 WHERE batch_id = ${batchId}`;

    // 为每个商品创建新的入库日志
    for (const newItem of items) {
      const { itemId, quantity, conditionId, operatorName, remark } = newItem;
      const stockItem = await getOne`SELECT quantity FROM stock_items WHERE id = ${itemId}` as any;
      const quantityBefore = stockItem.quantity - quantity;

      await run`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, batch_id)
        VALUES (${itemId}, 'in', ${quantity}, ${quantityBefore}, ${stockItem.quantity}, ${userId}, ${operatorName || (session.user as any).name || ''}, ${(remark || '').trim() + ' [重新入库]'}, ${batchId})
      `;
    }

    return NextResponse.json({
      success: true,
      message: '入库记录已更新',
      results,
    });
  } catch (error) {
    console.error('Error updating batch:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
