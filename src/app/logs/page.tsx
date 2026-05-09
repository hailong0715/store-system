'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Log {
  id: number;
  item_id: number;
  sku: string;
  item_name: string;
  operation_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  operator_id: number;
  operator_name: string;
  remark: string;
  created_at: string;
}

export default function LogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLogs();
    }
  }, [status]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/stock-items/logs');
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
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
    return <div className="p-8">加载中...</div>;
  }

  if (!session) {
    return <div className="p-8">请先登录</div>;
  }

  const isAdmin = (session.user as any)?.role === 'admin';

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">操作日志</h1>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
                {isAdmin && <th className="px-4 py-3 text-left text-sm font-medium">操作人</th>}
                <th className="px-4 py-3 text-left text-sm font-medium">操作类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">产品编码</th>
                <th className="px-4 py-3 text-left text-sm font-medium">产品名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">变化前</th>
                <th className="px-4 py-3 text-left text-sm font-medium">变化后</th>
                <th className="px-4 py-3 text-left text-sm font-medium">数量变化</th>
                <th className="px-4 py-3 text-left text-sm font-medium">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString('zh-CN')}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-sm">{log.operator_name || '-'}</td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${getOperationTypeColor(log.operation_type)}`}>
                      {getOperationTypeLabel(log.operation_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{log.sku || '-'}</td>
                  <td className="px-4 py-3 text-sm">{log.item_name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{log.quantity_before}</td>
                  <td className="px-4 py-3 text-sm">{log.quantity_after}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={log.quantity_change > 0 ? 'text-green-600 font-medium' : log.quantity_change < 0 ? 'text-red-600 font-medium' : ''}>
                      {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{log.remark || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
                    暂无操作记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
