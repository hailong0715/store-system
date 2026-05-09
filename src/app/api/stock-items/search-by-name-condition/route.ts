import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

// GET /api/stock-items/search-by-name-condition - 根据商品名称和属性查询库存
export async function GET(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || '';
    const conditionId = searchParams.get('conditionId');

    if (!name) {
      return NextResponse.json(null);
    }

    let query = `
      SELECT
        si.id,
        si.sku,
        si.name,
        si.category_id,
        si.quantity,
        si.unit,
        si.condition_id,
        c.name as category_name,
        pc.name as condition_name
      FROM stock_items si
      LEFT JOIN categories c ON si.category_id = c.id
      LEFT JOIN product_conditions pc ON si.condition_id = pc.id
      WHERE si.is_deleted = 0 AND si.name = '${name}'
    `;

    if (conditionId) {
      query += ` AND si.condition_id = ${parseInt(conditionId)}`;
    }

    const item = await getOne`${query}` as any;

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error searching stock item:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
