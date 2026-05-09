import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

export async function POST(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { logisticsName, logisticsNo, sender, phone, remark, items } = body;

    if (!logisticsName || !logisticsNo) {
      return NextResponse.json({ error: '物流名称和物流单号必填' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: '至少需要一条商品记录' }, { status: 400 });
    }

    const operatorId = (session.user as any)?.id || 1;
    const operatorName = session.user?.name || '未知';

    // Calculate total amount
    let totalAmount = 0;
    items.forEach((item: any) => {
      totalAmount += parseFloat(item.totalPrice) || 0;
    });

    // Insert purchase order
    const orderResult = await run`
      INSERT INTO purchase_orders (logistics_name, logistics_no, sender, phone, total_amount, status, operator_id, operator_name, remark)
      VALUES (${logisticsName}, ${logisticsNo}, ${sender || ''}, ${phone || ''}, ${totalAmount}, 'completed', ${operatorId}, ${operatorName}, ${remark || ''})
      RETURNING id
    `;

    const purchaseOrderId = orderResult[0].id;

    // Insert purchase order items and update stock
    for (const item of items) {
      // Insert purchase order item
      await run`
        INSERT INTO purchase_order_items (purchase_order_id, item_id, item_name, category_id, condition_id, good_quantity, bad_quantity, unit_price, total_price, remark)
        VALUES (${purchaseOrderId}, ${item.itemId}, ${item.itemName}, ${item.categoryId}, ${item.conditionId}, ${item.goodQuantity}, ${item.badQuantity}, ${item.unitPrice}, ${item.totalPrice}, ${item.remark || ''})
      `;

      // Update stock quantity for good items
      if (item.goodQuantity > 0 && item.itemId) {
        // 获取当前库存
        const currentStock = await getOne`SELECT quantity FROM stock_items WHERE id = ${item.itemId}` as any;

        const quantityBefore = currentStock?.quantity || 0;
        const quantityAfter = quantityBefore + item.goodQuantity;

        // 更新库存 - 直接用 itemId 更新
        await run`UPDATE stock_items SET quantity = quantity + ${item.goodQuantity}, updated_at = CURRENT_TIMESTAMP WHERE id = ${item.itemId}`;

        // Insert stock log
        await run`
          INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, condition_id)
          VALUES (${item.itemId}, 'in', ${item.goodQuantity}, ${quantityBefore}, ${quantityAfter}, ${operatorId}, ${operatorName}, ${'采购入库 - ' + (remark || '')}, ${item.conditionId})
        `;
      }
    }

    return NextResponse.json({ success: true, id: purchaseOrderId });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: '创建采购单失败' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, logisticsName, logisticsNo, sender, phone, remark, items } = body;

    if (!orderId) {
      return NextResponse.json({ error: '订单ID必填' }, { status: 400 });
    }

    if (!logisticsName || !logisticsNo) {
      return NextResponse.json({ error: '物流名称和物流单号必填' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: '至少需要一条商品记录' }, { status: 400 });
    }

    const operatorId = (session.user as any)?.id || 1;
    const operatorName = session.user?.name || '未知';

    // 获取原订单的所有商品记录
    const oldItems = await getAll`SELECT * FROM purchase_order_items WHERE purchase_order_id = ${orderId}` as any[];

    // 1. 回滚库存：将原良品数量从库存中减去
    for (const oldItem of oldItems) {
      if (oldItem.good_quantity > 0 && oldItem.item_id) {
        // 获取当前库存
        const currentStock = await getOne`SELECT quantity FROM stock_items WHERE id = ${oldItem.item_id}` as any;

        const quantityBefore = currentStock?.quantity || 0;
        const quantityAfter = quantityBefore - oldItem.good_quantity;

        // 回滚库存 - 直接用 item_id 更新
        await run`UPDATE stock_items SET quantity = quantity - ${oldItem.good_quantity}, updated_at = CURRENT_TIMESTAMP WHERE id = ${oldItem.item_id}`;

        // 记录回滚日志
        await run`
          INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, condition_id)
          VALUES (${oldItem.item_id}, 'out', ${-oldItem.good_quantity}, ${quantityBefore}, ${quantityAfter}, ${operatorId}, ${operatorName}, ${'采购单编辑回滚 - ' + oldItem.item_name}, ${oldItem.condition_id})
        `;
      }
    }

    // 2. 更新采购单主表
    let totalAmount = 0;
    items.forEach((item: any) => {
      totalAmount += parseFloat(item.totalPrice) || 0;
    });

    await run`
      UPDATE purchase_orders
      SET logistics_name = ${logisticsName}, logistics_no = ${logisticsNo}, sender = ${sender || ''}, phone = ${phone || ''}, total_amount = ${totalAmount}, remark = ${remark || ''}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${orderId}
    `;

    // 3. 删除原商品明细
    await run`DELETE FROM purchase_order_items WHERE purchase_order_id = ${orderId}`;

    // 4. 重新入库并插入新商品明细
    for (const item of items) {
      // 插入新商品明细
      await run`
        INSERT INTO purchase_order_items (purchase_order_id, item_id, item_name, category_id, condition_id, good_quantity, bad_quantity, unit_price, total_price, remark)
        VALUES (${orderId}, ${item.itemId}, ${item.itemName}, ${item.categoryId}, ${item.conditionId}, ${item.goodQuantity}, ${item.badQuantity}, ${item.unitPrice}, ${item.totalPrice}, ${item.remark || ''})
      `;

      // 重新入库
      if (item.goodQuantity > 0 && item.itemId) {
        // 获取当前库存
        const currentStock = await getOne`SELECT quantity FROM stock_items WHERE id = ${item.itemId}` as any;

        const quantityBefore = currentStock?.quantity || 0;
        const quantityAfter = quantityBefore + item.goodQuantity;

        // 更新库存 - 直接用 itemId 更新
        await run`UPDATE stock_items SET quantity = quantity + ${item.goodQuantity}, updated_at = CURRENT_TIMESTAMP WHERE id = ${item.itemId}`;

        // 记录入库日志
        await run`
          INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, condition_id)
          VALUES (${item.itemId}, 'in', ${item.goodQuantity}, ${quantityBefore}, ${quantityAfter}, ${operatorId}, ${operatorName}, ${'采购单编辑重新入库 - ' + (remark || '')}, ${item.conditionId})
        `;
      }
    }

    return NextResponse.json({ success: true, id: orderId });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: '更新采购单失败' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const logisticsNo = searchParams.get('logisticsNo');
    const phone = searchParams.get('phone');
    const sender = searchParams.get('sender');

    // 构建查询条件
    let whereClause = 'WHERE 1=1';

    if (startDate) {
      whereClause += ` AND po.created_at >= '${startDate}'`;
    }

    if (endDate) {
      whereClause += ` AND po.created_at <= '${endDate} 23:59:59'`;
    }

    if (logisticsNo) {
      whereClause += ` AND po.logistics_no LIKE '%${logisticsNo}%'`;
    }

    if (phone) {
      whereClause += ` AND po.phone LIKE '%${phone}%'`;
    }

    if (sender) {
      whereClause += ` AND po.sender LIKE '%${sender}%'`;
    }

    const orders = await getAll`
      SELECT po.*, u.name as operator_name
      FROM purchase_orders po
      LEFT JOIN users u ON po.operator_id = u.id
      ${whereClause}
      ORDER BY po.created_at DESC
    `;

    // Get items for each order
    const ordersWithItems = await Promise.all(orders.map(async (order: any) => {
      const items = await getAll`
        SELECT poi.*, c.name as category_name, pc.name as condition_name
        FROM purchase_order_items poi
        LEFT JOIN categories c ON poi.category_id = c.id
        LEFT JOIN product_conditions pc ON poi.condition_id = pc.id
        WHERE poi.purchase_order_id = ${order.id}
      `;
      return { ...order, items };
    }));

    return NextResponse.json(ordersWithItems);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: '获取采购单列表失败' }, { status: 500 });
  }
}
