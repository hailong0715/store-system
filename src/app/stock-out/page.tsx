'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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

interface StockOutRow {
  id: string;
  item: StockItem | null;
  originalName: string;
  conditionId: string;
  searchQuery: string;
  quantity: string;
  operator: string;
  remark: string;
  showDropdown: boolean;
  searchResults: StockItem[];
  searching: boolean;
}

export default function StockOutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [rows, setRows] = useState<StockOutRow[]>([]);
  const [loading, setLoading] = useState(false);

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
    const searchTimer: { [key: string]: NodeJS.Timeout } = {};

    rows.forEach((row) => {
      if (row.searchQuery && row.searchQuery.length > 0 && !row.item) {
        if (searchTimer[row.id]) {
          clearTimeout(searchTimer[row.id]);
        }

        searchTimer[row.id] = setTimeout(async () => {
          try {
            const res = await fetch(`/api/stock-items/search?q=${encodeURIComponent(row.searchQuery)}`);
            if (res.ok) {
              const data = await res.json();
              // 只显示有库存的商品
              const availableItems = data.filter((item: StockItem) => item.quantity > 0);
              setRows((prev) =>
                prev.map((r) =>
                  r.id === row.id
                    ? { ...r, searchResults: availableItems, showDropdown: availableItems.length > 0, searching: false }
                    : r
                )
              );
            }
          } catch (error) {
            console.error('Search failed:', error);
          }
        }, 300);
      } else if (!row.searchQuery || row.searchQuery.length === 0) {
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
      Object.values(searchTimer).forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rows.map(r => ({ id: r.id, searchQuery: r.searchQuery, hasItem: !!r.item })))]);

  // 当商品属性变化时，重新查询库存
  useEffect(() => {
    const fetchStockByCondition = async () => {
      for (const row of rows) {
        if (row.originalName && row.conditionId) {
          try {
            const res = await fetch(`/api/stock-items/search-by-name-condition?name=${encodeURIComponent(row.originalName)}&conditionId=${row.conditionId}`);
            if (res.ok) {
              const item = await res.json();
              if (item) {
                setRows((prev) =>
                  prev.map((r) =>
                    r.id === row.id
                      ? {
                          ...r,
                          item: {
                            ...r.item!,
                            id: item.id,
                            sku: item.sku,
                            quantity: item.quantity,
                            condition_id: item.condition_id,
                            condition_name: item.condition_name,
                          },
                          quantity: '',
                        }
                      : r
                  )
                );
              }
            }
          } catch (error) {
            console.error('Failed to fetch stock by condition:', error);
          }
        }
      }
    };

    fetchStockByCondition();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map(r => r.conditionId).join(',')]);

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
    const newRow: StockOutRow = {
      id: `row-${Date.now()}-${Math.random()}`,
      item: null,
      originalName: '',
      conditionId: '',
      searchQuery: '',
      quantity: '',
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

  const updateRow = (id: string, updates: Partial<StockOutRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const selectItem = (rowId: string, selectedItem: StockItem) => {
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

    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              item: newItem,
              originalName: newItem.name || '',
              conditionId: newItem.condition_id?.toString() || '',
              searchQuery: newItem.name || '',
              showDropdown: false,
              searchResults: [],
              quantity: '',
            }
          : row
      )
    );
  };

  const handleSubmit = async () => {
    const validRows = rows.filter(
      (row) => row.item && row.quantity && parseInt(row.quantity) > 0
    );

    if (validRows.length === 0) {
      alert('请至少填写一条完整的出库记录');
      return;
    }

    // 检查库存是否足够
    for (const row of validRows) {
      const qty = parseInt(row.quantity);
      if (qty > row.item!.quantity) {
        alert(`出库数量不能超过库存: ${row.item!.name}，库存 ${row.item!.quantity}`);
        return;
      }
    }

    for (const row of validRows) {
      if (!row.operator.trim()) {
        alert('请填写出库人员');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/stock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validRows.map((row) => ({
            itemId: row.item!.id,
            quantity: parseInt(row.quantity),
            conditionId: row.conditionId ? parseInt(row.conditionId) : null,
          })),
          rows: validRows.map((row) => ({
            operatorName: row.operator.trim(),
            remark: row.remark.trim(),
          })),
        }),
      });

      if (res.ok) {
        alert('出库成功');
        setRows([]);
        addRow();
      } else {
        const data = await res.json();
        alert(data.error || '出库失败');
      }
    } catch (error) {
      console.error('Stock out failed:', error);
      alert('出库失败');
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
          <h1 className="text-2xl font-bold">商品出库</h1>
          <button
            onClick={addRow}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            添加行
          </button>
        </div>

        {/* 出库单表格 */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-sm font-medium w-48">商品名称 *</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-28">商品属性</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-24">分类</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-20">当前库存</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-20">出库数量 *</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-20">出库人 *</th>
                  <th className="px-3 py-3 text-left text-sm font-medium flex-1">备注</th>
                  <th className="px-3 py-3 w-14"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id}>
                    {/* 商品名称 */}
                    <td className="px-3 py-2">
                      <div className="relative">
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
                              updateRow(row.id, {
                                searchQuery: e.target.value,
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
                                  selectItem(row.id, item);
                                }}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                              >
                                <div className="font-medium text-sm">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                  {item.sku} | 库存: {item.quantity} {item.unit || '个'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 商品属性 */}
                    <td className="px-3 py-2">
                      {row.item ? (
                        <select
                          value={row.conditionId}
                          onChange={(e) => updateRow(row.id, { conditionId: e.target.value })}
                          className="w-full px-2 py-1.5 border rounded-md text-sm"
                        >
                          <option value="">选择属性</option>
                          {conditions.map((cond) => (
                            <option key={cond.id} value={cond.id}>
                              {cond.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>

                    {/* 分类 */}
                    <td className="px-3 py-2">
                      <span className="text-sm text-gray-600">
                        {row.item?.category_name || '-'}
                      </span>
                    </td>

                    {/* 当前库存 */}
                    <td className="px-3 py-2">
                      <span className={`text-sm font-semibold ${row.item?.quantity !== undefined && row.item.quantity < 10 ? 'text-orange-500' : ''}`}>
                        {row.item?.quantity ?? '-'}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">
                        {row.item?.unit || '个'}
                      </span>
                    </td>

                    {/* 出库数量 */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        max={row.item?.quantity}
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                        placeholder="数量"
                        className="w-24 px-2 py-1.5 border rounded-md text-sm"
                      />
                      {row.quantity && row.item && parseInt(row.quantity) > row.item.quantity && (
                        <div className="text-xs text-red-500 mt-1">不能超过库存</div>
                      )}
                    </td>

                    {/* 出库人 */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.operator}
                        onChange={(e) => updateRow(row.id, { operator: e.target.value })}
                        placeholder="出库人"
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
            className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? '提交中...' : '确认出库'}
          </button>
        </div>
      </div>
    </div>
  );
}
