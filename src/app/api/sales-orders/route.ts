import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// 生成10位数字订单号
function generateOrderNo(): string {
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

// GET /api/sales-orders - 获取销售订单列表
export async function GET(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // 搜索参数
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const logisticsNo = searchParams.get('logisticsNo');
    const receiver = searchParams.get('receiver');
    const phone = searchParams.get('phone');
    const paymentStatus = searchParams.get('paymentStatus');

    if (id) {
      // 获取单个订单详情
      const order = await getOne`SELECT * FROM sales_orders WHERE id = ${id}` as any;

      if (!order) {
        return NextResponse.json({ error: '订单不存在' }, { status: 404 });
      }

      const items = await getAll`
        SELECT soi.*, si.sku, si.category_id, si.condition_id,
               c.name as category_name, pc.name as condition_name
        FROM sales_order_items soi
        LEFT JOIN stock_items si ON soi.item_id = si.id
        LEFT JOIN categories c ON soi.category_id = c.id
        LEFT JOIN product_conditions pc ON soi.condition_id = pc.id
        WHERE soi.sales_order_id = ${id}
      `;

      return NextResponse.json({ ...order, items });
    }

    // 构建搜索查询
    let query = 'SELECT * FROM sales_orders WHERE 1=1';

    if (startDate) {
      query += ` AND created_at >= '${startDate}'`;
    }

    if (endDate) {
      // 需要包含当天结束时间
      query += ` AND created_at <= '${endDate} 23:59:59'`;
    }

    if (logisticsNo) {
      query += ` AND logistics_no LIKE '%${logisticsNo}%'`;
    }

    if (receiver) {
      query += ` AND receiver LIKE '%${receiver}%'`;
    }

    if (phone) {
      query += ` AND phone LIKE '%${phone}%'`;
    }

    if (paymentStatus) {
      query += ` AND payment_status = '${paymentStatus}'`;
    }

    query += ' ORDER BY created_at DESC';

    const orders = await getAll`${query}`;

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error in GET sales-orders:', error);
    return NextResponse.json({ error: '获取订单失败' }, { status: 500 });
  }
}

// POST /api/sales-orders - 创建销售订单
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
    const { logisticsName, logisticsNo, receiver, phone, remark, items, paymentStatus } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '请提供销售商品列表' }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const userName = (session.user as any).name || (session.user as any).email || '';
    const batchId = uuidv4();

    // 计算总金额
    let totalAmount = 0;
    for (const item of items) {
      const qty = parseInt(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      totalAmount += qty * unitPrice;
    }

    // 生成订单号（10位数字）
    const orderNo = generateOrderNo();

    // 创建销售订单
    const orderResult = await run`
      INSERT INTO sales_orders (order_no, logistics_name, logistics_no, receiver, phone, total_amount, payment_status, operator_id, operator_name, remark)
      VALUES (${orderNo}, ${logisticsName || ''}, ${logisticsNo || ''}, ${receiver || ''}, ${phone || ''}, ${totalAmount}, ${paymentStatus || 'unpaid'}, ${userId}, ${userName}, ${remark || ''})
      RETURNING id
    `;

    const orderId = orderResult[0].id;

    // 处理每个商品
    for (const item of items) {
      const { itemId, quantity, conditionId, unitPrice, remark: itemRemark } = item;

      if (!itemId || !quantity || quantity <= 0) {
        return NextResponse.json({ error: `无效的商品或数量` }, { status: 400 });
      }

      const qty = parseInt(quantity);
      const price = parseFloat(unitPrice) || 0;
      const itemTotalPrice = qty * price;

      // 获取商品信息
      const stockItem = await getOne`SELECT * FROM stock_items WHERE id = ${itemId} AND is_deleted = 0` as any;
      if (!stockItem) {
        return NextResponse.json({ error: `商品不存在` }, { status: 404 });
      }

      const quantityBefore = stockItem.quantity;
      const quantityAfter = quantityBefore - qty;

      // 检查库存
      if (quantityAfter < 0) {
        return NextResponse.json({
          error: `库存不足: ${stockItem.name}，当前库存 ${quantityBefore}，出库数量 ${qty}`
        }, { status: 400 });
      }

      // 更新库存
      if (conditionId) {
        await run`UPDATE stock_items SET quantity = ${quantityAfter}, condition_id = ${conditionId}, updated_at = CURRENT_TIMESTAMP WHERE id = ${itemId}`;
      } else {
        await run`UPDATE stock_items SET quantity = ${quantityAfter}, updated_at = CURRENT_TIMESTAMP WHERE id = ${itemId}`;
      }

      // 记录库存日志
      await run`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, batch_id, condition_id)
        VALUES (${itemId}, 'out', ${-qty}, ${quantityBefore}, ${quantityAfter}, ${userId}, ${userName}, ${'销售单 #' + orderId}, ${batchId}, ${conditionId || null})
      `;

      // 保存销售订单商品明细
      await run`
        INSERT INTO sales_order_items (sales_order_id, item_id, item_name, category_id, condition_id, quantity, unit_price, total_price, remark)
        VALUES (${orderId}, ${itemId}, ${stockItem.name}, ${stockItem.category_id}, ${conditionId || null}, ${qty}, ${price}, ${itemTotalPrice}, ${itemRemark || ''})
      `;
    }

    return NextResponse.json({
      success: true,
      orderId,
      orderNo,
      totalAmount,
      itemCount: items.length,
    });
  } catch (error) {
    console.error('Error in POST sales-orders:', error);
    return NextResponse.json({ error: '创建销售订单失败' }, { status: 500 });
  }
}

// PUT /api/sales-orders - 编辑销售订单（回滚库存+重新出库）
export async function PUT(request: Request) {
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
    const { orderId, logisticsName, logisticsNo, receiver, phone, remark, items, paymentStatus } = body;

    if (!orderId) {
      return NextResponse.json({ error: '订单ID不能为空' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '请提供销售商品列表' }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const userName = (session.user as any).name || (session.user as any).email || '';
    const batchId = uuidv4();

    // 检查订单是否存在
    const existingOrder = await getOne`SELECT * FROM sales_orders WHERE id = ${orderId}` as any;
    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // 1. 获取原订单明细
    const oldItems = await getAll`SELECT * FROM sales_order_items WHERE sales_order_id = ${orderId}` as any[];

    // 2. 检查商品明细是否发生变化
    const hasItemsChanged = () => {
      if (oldItems.length !== items.length) return true;

      // 按itemId排序后比较
      const sortedOld = [...oldItems].sort((a, b) => a.item_id - b.item_id);
      const sortedNew = [...items].sort((a, b) => (a.itemId || 0) - (b.itemId || 0));

      for (let i = 0; i < sortedOld.length; i++) {
        const oldItem = sortedOld[i];
        const newItem = sortedNew[i];
        if (
          oldItem.item_id !== newItem.itemId ||
          oldItem.quantity !== parseInt(newItem.quantity) ||
          String(oldItem.condition_id) !== String(newItem.conditionId)
        ) {
          return true;
        }
      }
      return false;
    };

    const itemsChanged = hasItemsChanged();

    // 如果商品明细发生变化，才执行库存回滚和重新出库
    if (itemsChanged) {
      // 遍历原明细，执行库存回滚
      for (const oldItem of oldItems) {
        // 查询当前库存
        const stockItem = await getOne`SELECT * FROM stock_items WHERE id = ${oldItem.item_id} AND is_deleted = 0` as any;
        if (stockItem) {
          const quantityBefore = stockItem.quantity;
          const quantityAfter = quantityBefore + oldItem.quantity;

          // 更新库存（回滚）
          await run`UPDATE stock_items SET quantity = ${quantityAfter}, updated_at = CURRENT_TIMESTAMP WHERE id = ${oldItem.item_id}`;

          // 记录库存日志（回滚）
          await run`
            INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, batch_id, condition_id)
            VALUES (${oldItem.item_id}, 'in', ${oldItem.quantity}, ${quantityBefore}, ${quantityAfter}, ${userId}, ${userName}, ${'销售单 #' + orderId + ' 编辑回滚'}, ${batchId}, ${oldItem.condition_id})
          `;
        }
      }

      // 删除旧明细
      await run`DELETE FROM sales_order_items WHERE sales_order_id = ${orderId}`;
    }

    // 4. 计算新总金额
    let totalAmount = 0;
    for (const item of items) {
      const qty = parseInt(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      totalAmount += qty * unitPrice;
    }

    // 5. 更新主表
    await run`
      UPDATE sales_orders
      SET logistics_name = ${logisticsName || ''}, logistics_no = ${logisticsNo || ''}, receiver = ${receiver || ''}, phone = ${phone || ''}, total_amount = ${totalAmount}, payment_status = ${paymentStatus || 'unpaid'}, remark = ${remark || ''}
      WHERE id = ${orderId}
    `;

    // 6. 如果商品明细发生变化，执行出库
    if (itemsChanged) {
      // 遍历新明细，执行出库
      for (const item of items) {
        const { itemId, quantity, conditionId, unitPrice, remark: itemRemark } = item;

        if (!itemId || !quantity || quantity <= 0) {
          return NextResponse.json({ error: `无效的商品或数量` }, { status: 400 });
        }

        const qty = parseInt(quantity);
        const price = parseFloat(unitPrice) || 0;
        const itemTotalPrice = qty * price;

        // 获取商品信息
        const stockItem = await getOne`SELECT * FROM stock_items WHERE id = ${itemId} AND is_deleted = 0` as any;
        if (!stockItem) {
          return NextResponse.json({ error: `商品不存在` }, { status: 404 });
        }

        const quantityBefore = stockItem.quantity;
        const quantityAfter = quantityBefore - qty;

        // 检查库存
        if (quantityAfter < 0) {
          return NextResponse.json({
            error: `库存不足: ${stockItem.name}，当前库存 ${quantityBefore}，出库数量 ${qty}`
          }, { status: 400 });
        }

        // 更新库存
        if (conditionId) {
          await run`UPDATE stock_items SET quantity = ${quantityAfter}, condition_id = ${conditionId}, updated_at = CURRENT_TIMESTAMP WHERE id = ${itemId}`;
        } else {
          await run`UPDATE stock_items SET quantity = ${quantityAfter}, updated_at = CURRENT_TIMESTAMP WHERE id = ${itemId}`;
        }

        // 记录库存日志
        await run`
          INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, batch_id, condition_id)
          VALUES (${itemId}, 'out', ${-qty}, ${quantityBefore}, ${quantityAfter}, ${userId}, ${userName}, ${'销售单 #' + orderId + ' 编辑'}, ${batchId}, ${conditionId || null})
        `;

        // 保存销售订单商品明细
        await run`
          INSERT INTO sales_order_items (sales_order_id, item_id, item_name, category_id, condition_id, quantity, unit_price, total_price, remark)
          VALUES (${orderId}, ${itemId}, ${stockItem.name}, ${stockItem.category_id}, ${conditionId || null}, ${qty}, ${price}, ${itemTotalPrice}, ${itemRemark || ''})
        `;
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      totalAmount,
      itemCount: items.length,
    });
  } catch (error) {
    console.error('Error in PUT sales-orders:', error);
    return NextResponse.json({ error: '编辑销售订单失败' }, { status: 500 });
  }
}
