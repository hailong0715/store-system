'use client';

import { useState, useEffect } from 'react';

interface BatchItem {
  log_id: number;
  item_id: number;
  item_name: string;
  sku: string;
  category_name: string | null;
  condition_id: number | null;
  condition_name: string | null;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  operator_name: string;
  remark: string;
}

interface Batch {
  batchId: string;
  operatorName: string;
  createdAt: string;
  isRevised: number;
  itemCount: number;
  items: BatchItem[];
}

interface ProductCondition {
  id: number;
  name: string;
}

interface EditRow {
  id: string;
  item: BatchItem | null;
  quantity: string;
  condition_id: string;
  operator: string;
  remark: string;
}

export default function StockInHistoryModal() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchBatches();
      fetchConditions();
    }
  }, [isOpen]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);

      console.log('Fetching batches from API...');
      const res = await fetch(`/api/stock-in/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data);
      } else {
        const err = await res.json();
        console.error('API error:', err);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConditions = async () => {
    try {
      const res = await fetch('/api/product-conditions');
      if (res.ok) {
        const data = await res.json();
        setConditions(data);
      }
    } catch (error) {
      console.error('Failed to fetch conditions:', error);
    }
  };

  const handleSearch = () => {
    fetchBatches();
  };

  const handleEdit = async (batch: Batch) => {
    // 获取完整的批次详情
    try {
      const res = await fetch(`/api/stock-in/history/${batch.batchId}`);
      if (res.ok) {
        const data = await res.json();
        setEditingBatch(data);

        // 初始化编辑行
        const rows: EditRow[] = data.items.map((item: BatchItem) => ({
          id: `row-${item.log_id}`,
          item: item,
          quantity: item.quantity_change.toString(),
          condition_id: item.condition_id?.toString() || '',
          operator: item.operator_name,
          remark: item.remark?.replace(' [重新入库]', '') || '',
        }));
        setEditRows(rows);
      }
    } catch (error) {
      console.error('Failed to fetch batch details:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingBatch(null);
    setEditRows([]);
  };

  const updateEditRow = (id: string, updates: Partial<EditRow>) => {
    setEditRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updates } : row))
    );
  };

  const handleSubmitEdit = async () => {
    if (!editingBatch) return;

    // 验证
    const validRows = editRows.filter(
      (row) => row.item && row.quantity && parseInt(row.quantity) > 0 && row.condition_id
    );

    if (validRows.length === 0) {
      alert('请至少填写一条完整的入库记录');
      return;
    }

    for (const row of validRows) {
      if (!row.operator.trim()) {
        alert('请填写入库人');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/stock-in/history/${editingBatch.batchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validRows.map((row) => ({
            itemId: row.item!.item_id,
            quantity: parseInt(row.quantity),
            conditionId: parseInt(row.condition_id),
            operatorName: row.operator.trim(),
            remark: row.remark.trim(),
          })),
        }),
      });

      if (res.ok) {
        alert('更新成功');
        handleCancelEdit();
        fetchBatches();
      } else {
        const data = await res.json();
        alert(data.error || '更新失败');
      }
    } catch (error) {
      console.error('Failed to update:', error);
      alert('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 暴露打开弹窗的方法
  useEffect(() => {
    (window as any).openStockInHistory = () => setIsOpen(true);
    return () => {
      delete (window as any).openStockInHistory;
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">入库历史记录</h2>
          <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
            &times;
          </button>
        </div>

        {/* 批次列表 */}
        {!editingBatch && (
          <>
            {/* 搜索 */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索商品名称..."
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                搜索
              </button>
            </div>

            {/* 批次列表 */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="text-center py-8">加载中...</div>
              ) : batches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">暂无入库记录</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-medium">批次号</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">入库人</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">商品数量</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">入库时间</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">状态</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {batches.map((batch) => (
                      <tr key={batch.batchId} className={batch.isRevised ? 'bg-gray-50' : ''}>
                        <td className="px-3 py-2 font-mono text-sm">{batch.batchId.slice(0, 8)}...</td>
                        <td className="px-3 py-2">{batch.operatorName}</td>
                        <td className="px-3 py-2">{batch.itemCount} 件</td>
                        <td className="px-3 py-2 text-sm">{formatDate(batch.createdAt)}</td>
                        <td className="px-3 py-2">
                          {batch.isRevised ? (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">已修订</span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">正常</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {!batch.isRevised && (
                            <button
                              onClick={() => handleEdit(batch)}
                              className="text-blue-500 hover:text-blue-700 text-sm"
                            >
                              编辑
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* 编辑表单 */}
        {editingBatch && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">编辑入库单 - {editingBatch.batchId.slice(0, 8)}...</h3>
              <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700">
                返回列表
              </button>
            </div>

            {/* 入库单表格 */}
            <div className="flex-1 overflow-auto bg-white rounded-lg shadow border">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-sm font-medium">商品名称</th>
                    <th className="px-3 py-2 text-left text-sm font-medium">分类</th>
                    <th className="px-3 py-2 text-left text-sm font-medium">入库数量</th>
                    <th className="px-3 py-2 text-left text-sm font-medium">商品属性</th>
                    <th className="px-3 py-2 text-left text-sm font-medium">入库人</th>
                    <th className="px-3 py-2 text-left text-sm font-medium">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {editRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.item?.item_name}</div>
                        <div className="text-xs text-gray-500">{row.item?.sku}</div>
                      </td>
                      <td className="px-3 py-2 text-sm">{row.item?.category_name || '-'}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) => updateEditRow(row.id, { quantity: e.target.value })}
                          className="w-24 px-2 py-1 border rounded-md text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.condition_id}
                          onChange={(e) => updateEditRow(row.id, { condition_id: e.target.value })}
                          className="w-32 px-2 py-1 border rounded-md text-sm"
                        >
                          <option value="">选择属性</option>
                          {conditions.map((cond) => (
                            <option key={cond.id} value={cond.id}>
                              {cond.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.operator}
                          onChange={(e) => updateEditRow(row.id, { operator: e.target.value })}
                          className="w-24 px-2 py-1 border rounded-md text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.remark}
                          onChange={(e) => updateEditRow(row.id, { remark: e.target.value })}
                          className="w-full px-2 py-1 border rounded-md text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 提交按钮 */}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmitEdit}
                disabled={submitting}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认重新入库'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
