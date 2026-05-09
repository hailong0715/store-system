import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, initDb } from '@/lib/db';

// GET /api/stock-in/history - 获取入库历史记录（按批次）
export async function GET(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // 获取用户角色和ID
    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    // 构建基础查询
    let whereClause = "WHERE sl.operation_type = 'in' AND sl.batch_id IS NOT NULL";
    const params: any[] = [];

    // 搜索商品名称
    if (search) {
      whereClause += ' AND si.name LIKE ${' + params.length + '}';
      params.push(`%${search}%`);
    }

    // 普通用户只能查看自己的记录，管理员可以查看全部
    if (userRole !== 'admin') {
      whereClause += ' AND sl.operator_id = ${' + params.length + '}';
      params.push(userId);
    }

    // 先获取符合条件的批次列表
    const batches = await getAll`
      SELECT DISTINCT
        sl.batch_id,
        sl.operator_name,
        sl.created_at,
        sl.is_revised
      FROM stock_logs sl
      LEFT JOIN stock_items si ON sl.item_id = si.id
      ${whereClause}
      ORDER BY sl.created_at DESC
    ` as any[];

    console.log('Batches found:', batches.length);

    // 获取每个批次的详细信息
    const result = await Promise.all(batches.map(async (batch) => {
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
          c.name as category_name,
          pc.name as condition_name
        FROM stock_logs sl
        LEFT JOIN stock_items si ON sl.item_id = si.id
        LEFT JOIN categories c ON si.category_id = c.id
        LEFT JOIN product_conditions pc ON sl.condition_id = pc.id
        WHERE sl.batch_id = ${batch.batch_id}
      `;

      return {
        batchId: batch.batch_id,
        operatorName: batch.operator_name,
        createdAt: batch.created_at,
        isRevised: batch.is_revised,
        itemCount: items.length,
        items,
      };
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching stock in history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
