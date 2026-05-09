'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';

interface DashboardData {
  totalQuantity: number;
  totalItemCount: number;
  itemsByQuantity: any[];
  recentLogs: any[];
  lowStockItems: any[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDashboardData();
    }
  }, [status]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOperationTypeLabel = (type: string) => {
    switch (type) {
      case 'in': return '入库';
      case 'out': return '出库';
      case 'create': return '创建';
      case 'update': return '更新';
      case 'delete': return '删除';
      default: return type;
    }
  };

  const getOperationTypeColor = (type: string) => {
    switch (type) {
      case 'in': return 'bg-green-100 text-green-800';
      case 'out': return 'bg-red-100 text-red-800';
      case 'create': return 'bg-blue-100 text-blue-800';
      case 'update': return 'bg-yellow-100 text-yellow-800';
      case 'delete': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (!session || !session.user) {
    return null;
  }

  const role = (session.user as any)?.role || 'user';

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">控制台</h1>

        {/* Welcome Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <p className="text-lg">欢迎回来，{session.user?.name}！</p>
          <p className="text-gray-600 mt-2">角色: {role === 'admin' ? '管理员' : '普通用户'}</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">库存总量</div>
            <div className="text-3xl font-bold text-blue-600">{data?.totalQuantity || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 mb-1">商品种类</div>
            <div className="text-3xl font-bold text-green-600">{data?.totalItemCount || 0}</div>
          </div>
        </div>

        {/* Low Stock Warning */}
        {data?.lowStockItems && data.lowStockItems.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-orange-600">库存预警</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">产品编码</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">产品名称</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">商品属性</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">当前库存</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-2 font-mono text-sm">{item.sku}</td>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2 text-gray-600">{item.condition_name || '-'}</td>
                      <td className="px-4 py-2">
                        <span className="text-orange-600 font-semibold">{item.quantity}</span>
                        <span className="text-gray-500 text-sm ml-1">{item.unit || '个'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Items by Quantity */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">库存排行榜 (按数量降序)</h2>
          {data?.itemsByQuantity && data.itemsByQuantity.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">排名</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">产品编码</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">产品名称</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">分类</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">商品属性</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">当前库存</th>
                  </tr>
                </thead>
                <tbody>
                  {data.itemsByQuantity.map((item, index) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          #{index + 1}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-sm">{item.sku}</td>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2 text-gray-600">{item.category_name || '-'}</td>
                      <td className="px-4 py-2 text-gray-600">{item.condition_name || '-'}</td>
                      <td className="px-4 py-2">
                        <span className="font-semibold">{item.quantity}</span>
                        <span className="text-gray-500 text-sm ml-1">{item.unit || '个'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">暂无商品数据</p>
          )}
        </div>

        {/* Recent Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">最近操作记录</h2>
          {data?.recentLogs && data.recentLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">时间</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">操作人</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">操作类型</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">商品</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">商品属性</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">数量变化</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLogs.map((log) => (
                    <tr key={log.id} className="border-t">
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-2 text-sm">{log.operator_name || '-'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${getOperationTypeColor(log.operation_type)}`}>
                          {getOperationTypeLabel(log.operation_type)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">{log.item_name || log.sku || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{log.condition_name || '-'}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={log.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}>
                          {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{log.remark || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">暂无操作记录</p>
          )}
        </div>
      </div>
    </div>
  );
}
