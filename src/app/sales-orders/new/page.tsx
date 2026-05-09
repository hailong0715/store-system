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

interface SalesOrderRow {
  id: string;
  item: StockItem | null;
  originalName: string;
  conditionId: string;
  searchQuery: string;
  quantity: string;
  unitPrice: string;
  remark: string;
  showDropdown: boolean;
  searchResults: StockItem[];
  searching: boolean;
}

export default function NewSalesOrderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [rows, setRows] = useState<SalesOrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 订单公共字段
  const [logisticsName, setLogisticsName] = useState('');
  const [logisticsNo, setLogisticsNo] = useState('');
  const [receiver, setReceiver] = useState('');
  const [phone, setPhone] = useState('');
  const [orderRemark, setOrderRemark] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('unpaid');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchConditions();
      // 默认显示5行
      const initialRows: SalesOrderRow[] = [];
      for (let i = 0; i < 5; i++) {
        initialRows.push({
          id: `row-${Date.now()}-${Math.random()}-${i}`,
          item: null,
          originalName: '',
          conditionId: '',
          searchQuery: '',
          quantity: '',
          unitPrice: '',
          remark: '',
          showDropdown: false,
          searchResults: [],
          searching: false,
        });
      }
      setRows(initialRows);
    }
  }, [status]);

  // 商品搜索
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
                          // 保留用户已填写的数量，不清空
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
    const newRow: SalesOrderRow = {
      id: `row-${Date.now()}-${Math.random()}`,
      item: null,
      originalName: '',
      conditionId: '',
      searchQuery: '',
      quantity: '',
      unitPrice: '',
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

  const updateRow = (id: string, updates: Partial<SalesOrderRow>) => {
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
              // 保留用户已填写的数量和单价
            }
          : row
      )
    );
  };

  // 计算单行总价
  const calculateRowTotal = (row: SalesOrderRow) => {
    const qty = parseInt(row.quantity) || 0;
    const price = parseFloat(row.unitPrice) || 0;
    return qty * price;
  };

  // 计算订单总金额
  const calculateTotalAmount = () => {
    return rows.reduce((sum, row) => sum + calculateRowTotal(row), 0);
  };

  const handleSubmit = async () => {
    const validRows = rows.filter(
      (row) => row.item && row.quantity && parseInt(row.quantity) > 0
    );

    if (validRows.length === 0) {
      alert('请至少填写一条完整的销售记录');
      return;
    }

    // 检查库存
    for (const row of validRows) {
      const qty = parseInt(row.quantity);
      if (qty > row.item!.quantity) {
        alert(`出库数量不能超过库存: ${row.item!.name}，库存 ${row.item!.quantity}`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logisticsName,
          logisticsNo,
          receiver,
          phone,
          remark: orderRemark,
          paymentStatus,
          items: validRows.map((row) => ({
            itemId: row.item!.id,
            quantity: parseInt(row.quantity),
            conditionId: row.conditionId ? parseInt(row.conditionId) : null,
            unitPrice: parseFloat(row.unitPrice) || 0,
            remark: row.remark.trim(),
          })),
        }),
      });

      if (res.ok) {
        alert('销售单创建成功');
        router.push('/sales-orders');
      } else {
        const data = await res.json();
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('Create sales order failed:', error);
      alert('创建失败');
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
          <h1 className="text-2xl font-bold">新建销售单</h1>
          <button
            onClick={() => router.push('/sales-orders')}
            className="text-gray-500 hover:text-gray-700"
          >
            返回列表
          </button>
        </div>

        {/* 商品表格 */}
        <div className="bg-white rounded-lg shadow border overflow-hidden mb-6">
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b">
            <h2 className="font-medium">商品明细</h2>
            <button
              onClick={addRow}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              添加商品
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-sm font-medium w-40">商品名称 *</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-24">商品属性</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-20">分类</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-20">当前库存</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-20">出库数量 *</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-24">销售单价</th>
                  <th className="px-3 py-3 text-left text-sm font-medium w-24">销售总价</th>
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

                    {/* 销售单价 */}
                    <td className="px-3 py-2">
                      <div className="flex items-center">
                        <span className="text-gray-500 mr-1">¥</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.unitPrice}
                          onChange={(e) => updateRow(row.id, { unitPrice: e.target.value })}
                          placeholder="0.00"
                          className="w-24 px-2 py-1.5 border rounded-md text-sm"
                        />
                      </div>
                    </td>

                    {/* 销售总价 */}
                    <td className="px-3 py-2">
                      <span className="text-sm font-semibold text-orange-500">
                        ¥{calculateRowTotal(row).toFixed(2)}
                      </span>
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

        {/* 订单信息 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h2 className="font-medium mb-4">订单信息</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">物流名称</label>
              <input
                type="text"
                value={logisticsName}
                onChange={(e) => setLogisticsName(e.target.value)}
                placeholder="如：顺丰速运"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">物流单号</label>
              <input
                type="text"
                value={logisticsNo}
                onChange={(e) => setLogisticsNo(e.target.value)}
                placeholder="快递单号"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">收货人</label>
              <input
                type="text"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="收货人姓名"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">联系电话</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="手机号"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">付款状态</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="unpaid">未付款</option>
                <option value="paid">已付款</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">订单备注</label>
              <input
                type="text"
                value={orderRemark}
                onChange={(e) => setOrderRemark(e.target.value)}
                placeholder="订单备注信息"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center pt-4 border-t">
            <div className="text-lg">
              订单总金额：<span className="text-2xl font-bold text-orange-500">¥{calculateTotalAmount().toFixed(2)}</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? '提交中...' : '创建销售单'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
