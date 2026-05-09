import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOne, getAll, run, getLastInsertId, initDb } from '@/lib/db';

export async function GET() {
  try {
    await initDb();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get total stock quantity
    const totalQuantityResult = await getOne`SELECT COALESCE(SUM(quantity), 0) as total FROM stock_items WHERE is_deleted = 0` as any;
    const totalQuantity = totalQuantityResult?.total || 0;

    // Get total item count
    const totalItemCountResult = await getOne`SELECT COUNT(*) as count FROM stock_items WHERE is_deleted = 0` as any;
    const totalItemCount = totalItemCountResult?.count || 0;

    // Get items sorted by quantity descending
    const itemsByQuantity = await getAll`
      SELECT si.*, c.name as category_name, pc.name as condition_name
      FROM stock_items si
      LEFT JOIN categories c ON si.category_id = c.id
      LEFT JOIN product_conditions pc ON si.condition_id = pc.id
      WHERE si.is_deleted = 0
      ORDER BY si.quantity DESC
      LIMIT 10
    `;

    // Get recent logs
    const recentLogs = await getAll`
      SELECT sl.*, si.sku, si.name as item_name, u.name as operator_name, pc.name as condition_name
      FROM stock_logs sl
      LEFT JOIN stock_items si ON sl.item_id = si.id
      LEFT JOIN users u ON sl.operator_id = u.id
      LEFT JOIN product_conditions pc ON sl.condition_id = pc.id
      ORDER BY sl.created_at DESC
      LIMIT 10
    `;

    // Get low stock items (quantity < 10)
    const lowStockItems = await getAll`
      SELECT si.*, c.name as category_name, pc.name as condition_name
      FROM stock_items si
      LEFT JOIN categories c ON si.category_id = c.id
      LEFT JOIN product_conditions pc ON si.condition_id = pc.id
      WHERE si.is_deleted = 0 AND si.quantity < 10
      ORDER BY si.quantity ASC
      LIMIT 10
    `;

    return NextResponse.json({
      totalQuantity,
      totalItemCount,
      itemsByQuantity,
      recentLogs,
      lowStockItems,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
