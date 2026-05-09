import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const logs = await getAll`
      SELECT sl.*, si.name as item_name, si.sku
      FROM stock_logs sl
      LEFT JOIN stock_items si ON sl.item_id = si.id
      WHERE sl.operator_id = ${parseInt(userId)}
      ORDER BY sl.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Get user logs error:', error);
    return NextResponse.json({ error: 'Failed to get logs' }, { status: 500 });
  }
}
