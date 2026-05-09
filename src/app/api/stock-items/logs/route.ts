import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const itemId = searchParams.get('itemId');

    let query = `
      SELECT
        sl.*,
        si.sku,
        si.name as item_name
      FROM stock_logs sl
      LEFT JOIN stock_items si ON sl.item_id = si.id
      WHERE 1=1
    `;

    // If not admin, only show current user's logs
    if ((session.user as any).role !== 'admin') {
      query += ` AND sl.operator_id = ${(session.user as any).id}`;
    }

    if (userId) {
      query += ` AND sl.operator_id = ${parseInt(userId)}`;
    }

    if (itemId) {
      query += ` AND sl.item_id = ${parseInt(itemId)}`;
    }

    query += ' ORDER BY sl.created_at DESC';

    const logs = await getAll`${query}`;

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
