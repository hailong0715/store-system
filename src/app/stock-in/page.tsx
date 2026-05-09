'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import StockItemFormModal from '@/app/components/StockItemFormModal';
import StockInHistoryModal from '@/app/components/StockInHistoryModal';

interface ProductCondition {
  id: number;
  name: string;
}

interface StockItem {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category_name: string | null;
  condition_id: number | null;
  condition_name: string | null;
  quantity: number;
  unit: string | null;
}

interface StockInRow {
  id: string;
  item: StockItem | null;
  searchQuery: string;
  quantity: string;
  condition_id: string;
  operator: string;
  remark: string;
  showDropdown: boolean;
  searchResults: StockItem[];
  searching: boolean;
}

export default function StockInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [rows, setRows] = useState<StockInRow[]>([]);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchConditions();
      addRow();
    }
  }, [status]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setRows((prev) => prev.map((row) => ({ ...row, showDropdown: false })));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 监听搜索词变化，自动搜索
  useEffect(() => {
    const debounceTimers: { [key: string]: NodeJS.Timeout } = {};

    rows.forEach((row) => {
      if (row.searchQuery && row.searchQuery.length > 0 && !row.item) {
        // 清除之前的定时器
        if (debounceTimers[row.id]) {
          clearTimeout(debounceTimers[row.id]);
        }

        debounceTimers[row.id] = setTimeout(async () => {
          // console.log('Searching for:', row.searchQuery);
          try {
            const res = await fetch(`/api/stock-items/search?q=${encodeURIComponent(row.searchQuery)}`);
            if (res.ok) {
              const data = await res.json();
              console.log('Search results:', data);
              setRows((prev) =>
                prev.map((r) =>
                  r.id === row.id
                    ? { ...r, searchResults: data, showDropdown: data.length > 0, searching: false }
                    : r
                )
              );
            }
          } catch (error) {
            console.error('Search failed:', error);
          }
        }, 300);
      } else if (!row.searchQuery || row.searchQuery.length === 0) {
        // 清空搜索结果
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, searchResults: [], showDropdown: false, searching: false }
              : r
          )
        );
      }
    });

    return () => {
      Object.values(debounceTimers).forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rows.map(r => ({ id: r.id, searchQuery: r.searchQuery, hasItem: !!r.item })))]);

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

  const addRow = () => {
    const newRow: StockInRow = {
      id: `row-${Date.now()}-${Math.random()}`,
      item: null,
      searchQuery: '',
      quantity: '',
      condition_id: '',
      operator: (session?.user as any)?.name || (session?.user as any)?.email || '',
      remark: '',
      showDropdown: false,
      searchResults: [],
      searching: false,
    };
    setRows((prev) => [...prev, newRow]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows((prev) => prev.filter((row) => row.id !== id));
    }
  };

  const updateRow = (id: string, updates: Partial<StockInRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const searchItems = async (rowId: string, query: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    if (query.length < 1) {
      updateRow(rowId, { searchResults: [], showDropdown: false });
      return;
    }

    updateRow(rowId, { searching: true });

    try {
      const res = await fetch(`/api/stock-items/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        updateRow(rowId, {
          searchResults: data,
          showDropdown: true,
          searching: false,
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      updateRow(rowId, { searching: false });
    }
  };

  const selectItem = (rowId: string, selectedItem: StockItem) => {
    console.log('Selecting item:', JSON.stringify(selectedItem));

    const newItem: StockItem = {
      id: selectedItem.id,
      sku: selectedItem.sku,
      name: selectedItem.name,
      category_id: selectedItem.category_id,
      category_name: selectedItem.category_name,
      condition_id: selectedItem.condition_id,
      condition_name: selectedItem.condition_name,
      quantity: selectedItem.quantity,
      unit: selectedItem.unit,
    };

    console.log('New item to set:', JSON.stringify(newItem));

    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              item: newItem,
              searchQuery: newItem.name || '',
              showDropdown: false,
              searchResults: [],
              condition_id: newItem.condition_id?.toString() || '',
            }
          : row
      )
    );
  };

  const handleCreateItemSuccess = (newItem: { id: number; name: string; category_id: number | null; category_name: string | null }) => {
    const item: StockItem = {
      id: newItem.id,
      sku: '',
      name: newItem.name,
      category_id: newItem.category_id,
      category_name: newItem.category_name,
      condition_id: null,
      condition_name: null,
      quantity: 0,
      unit: null,
    };

    if (pendingRowId) {
      selectItem(pendingRowId, item);
    }
    setShowNewItemModal(false);
    setPendingRowId(null);
  };

  const handleSubmit = async () => {
    // 验证
    const validRows = rows.filter((row) => row.item && row.quantity && parseInt(row.quantity) > 0 && row.condition_id);

    if (validRows.length === 0) {
      // 找出具体缺少什么
      const firstRow = rows[0];
      if (!firstRow.item) {
        alert('请选择商品');
      } else if (!firstRow.quantity || parseInt(firstRow.quantity) <= 0) {
        alert('请填写入库数量');
      } else if (!firstRow.condition_id) {
        alert('请选择商品属性');
      }
      return;
    }

    for (const row of validRows) {
      if (!row.operator.trim()) {
        alert('请填写入库人员');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validRows.map((row) => ({
            itemId: row.item!.id,
            quantity: parseInt(row.quantity),
            conditionId: parseInt(row.condition_id),
          })),
          rows: validRows.map((row) => ({
            operatorName: row.operator.trim(),
            remark: row.remark.trim(),
          })),
        }),
      });

      if (res.ok) {
        alert('入库成功');
        setRows([]);
        addRow();
      } else {
        const data = await res.json();
        alert(data.error || '入库失败');
      }
    } catch (error) {
      console.error('Stock in failed:', error);
      alert('入库失败');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <div className="p-8">加载中...</div>;
  }

  if (!session) {
    return <div className="p-8">请先登录</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">商品入库</h1>
          <div className="flex gap-2">
            <button
              onClick={addRow}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              添加行
            </button>
            <button
              onClick={() => setShowNewItemModal(true)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              新建商品
            </button>
            <button
              onClick={() => (window as any).openStockInHistory?.()}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              历史记录
            </button>
          </div>
        </div>

        {/* 入库单表格 */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-sm font-medium w-64">商品名称 *</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-40">分类</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-28">入库数量 *</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-32">商品属性 *</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-28">入库人 *</th>
                  <th className="px-3 py-3 text-left text-sm font-medium flex-1">备注</th>
                  <th className="px-3 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id}>
                    {/* 商品名称 */}
                    <td className="px-3 py-2">
                      <div className="relative" ref={dropdownRef}>
                        <input
                          type="text"
                          readOnly
                          value={row.item?.name || row.searchQuery || ''}
                          placeholder="搜索商品名称"
                          className="w-full px-2 py-1.5 border rounded-md text-sm bg-gray-50"
                        />
                        {!row.item && (
                          <input
                            type="text"
                            value={row.searchQuery}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateRow(row.id, {
                                searchQuery: value,
                                showDropdown: true,
                              });
                            }}
                            onFocus={() => row.searchResults.length > 0 && updateRow(row.id, { showDropdown: true })}
                            placeholder="搜索商品名称"
                            className="w-full px-2 py-1.5 border rounded-md text-sm absolute inset-0 bg-transparent"
                          />
                        )}
                        {row.showDropdown && row.searchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {row.searchResults.map((item: StockItem) => (
                              <div
                                key={item.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  console.log('onMouseDown 点击了商品:', item.name, 'category:', item.category_name);
                                  selectItem(row.id, item);
                                }}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                              >
                                <div className="font-medium text-sm">{item.name}</div>
                                <div className="text-xs text-gray-500">{item.sku} | 分类: {item.category_name || '-'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {row.searching && (
                          <div className="absolute right-2 top-2 text-xs text-gray-500">搜索中...</div>
                        )}
                      </div>
                    </td>

                    {/* 分类 */}
                    <td className="px-3 py-2">
                      <span className="text-sm text-gray-600">
                        {row.item?.category_name || '-'}
                      </span>
                    </td>

                    {/* 入库数量 */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                        placeholder="数量"
                        className="w-full px-2 py-1.5 border rounded-md text-sm"
                      />
                    </td>

                    {/* 商品属性 */}
                    <td className="px-3 py-2">
                      <select
                        value={row.condition_id}
                        onChange={(e) => updateRow(row.id, { condition_id: e.target.value })}
                        className="w-full px-2 py-1.5 border rounded-md text-sm"
                        required
                      >
                        <option value="">选择属性</option>
                        {conditions.map((cond) => (
                          <option key={cond.id} value={cond.id}>
                            {cond.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* 入库人 */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.operator}
                        onChange={(e) => updateRow(row.id, { operator: e.target.value })}
                        placeholder="入库人"
                        className="w-full px-2 py-1.5 border rounded-md text-sm"
                      />
                    </td>

                    {/* 备注 */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.remark}
                        onChange={(e) => updateRow(row.id, { remark: e.target.value })}
                        placeholder="备注"
                        className="w-full px-2 py-1.5 border rounded-md text-sm"
                      />
                    </td>

                    {/* 删除按钮 */}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        disabled={rows.length === 1}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 提交按钮 */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '提交中...' : '确认入库'}
          </button>
        </div>
      </div>

      {/* 新建商品弹窗 */}
      <StockItemFormModal
        isOpen={showNewItemModal}
        onClose={() => {
          setShowNewItemModal(false);
          setPendingRowId(null);
        }}
        onSuccess={handleCreateItemSuccess}
      />

      {/* 历史记录弹窗 */}
      <StockInHistoryModal />
    </div>
  );
}
