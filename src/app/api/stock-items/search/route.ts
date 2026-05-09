import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

// GET /api/stock-items/search - 搜索商品（用于联想输入）
export async function GET(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    if (!q || q.length < 1) {
      return NextResponse.json([]);
    }

    const items = await getAll`
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
      WHERE si.is_deleted = 0 AND si.name LIKE ${'%' + q + '%'}
      ORDER BY si.name ASC
      LIMIT 20
    `;

    console.log('Search API返回:', JSON.stringify(items));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error searching stock items:', error);
    return NextResponse.json({ error: 'Failed to search stock items' }, { status: 500 });
  }
}
