'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import html2canvas from 'html2canvas';

interface SalesOrder {
  id: number;
  order_no: string;
  logistics_name: string;
  logistics_no: string;
  receiver: string;
  phone: string;
  total_amount: number;
  payment_status: string;
  status: string;
  operator_name: string;
  remark: string;
  created_at: string;
}

interface SalesOrderItem {
  id: number;
  item_id: number;
  item_name: string;
  category_id: number | null;
  category_name: string;
  condition_id: number | null;
  condition_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  remark: string;
}

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

interface EditRow {
  id: string;
  item: StockItem | null;
  itemId: string;
  originalItemId: number | null;
  originalConditionId: number | null;
  conditionId: string;
  searchQuery: string;
  quantity: string;
  unitPrice: string;
  remark: string;
  showDropdown: boolean;
  searchResults: StockItem[];
  searching: boolean;
}

export default function SalesOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([]);
  const [showModal, setShowModal] = useState(false);

  // 编辑相关状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [editItems, setEditItems] = useState<EditRow[]>([]);
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    logisticsName: '',
    logisticsNo: '',
    receiver: '',
    phone: '',
    paymentStatus: 'unpaid',
    remark: '',
  });

  // 搜索相关状态
  const [searchForm, setSearchForm] = useState({
    startDate: '',
    endDate: '',
    logisticsNo: '',
    receiver: '',
    phone: '',
    paymentStatus: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrders();
    }
  }, [status]);

  const fetchOrders = async (searchParams?: URLSearchParams) => {
    try {
      const url = searchParams ? `/api/sales-orders?${searchParams.toString()}` : '/api/sales-orders';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchForm.startDate) params.set('startDate', searchForm.startDate);
    if (searchForm.endDate) params.set('endDate', searchForm.endDate);
    if (searchForm.logisticsNo) params.set('logisticsNo', searchForm.logisticsNo);
    if (searchForm.receiver) params.set('receiver', searchForm.receiver);
    if (searchForm.phone) params.set('phone', searchForm.phone);
    if (searchForm.paymentStatus) params.set('paymentStatus', searchForm.paymentStatus);
    fetchOrders(params);
  };

  const handleReset = () => {
    setSearchForm({
      startDate: '',
      endDate: '',
      logisticsNo: '',
      receiver: '',
      phone: '',
      paymentStatus: '',
    });
    setLoading(true);
    fetchOrders();
  };

  const viewOrder = async (orderId: number) => {
    try {
      const res = await fetch(`/api/sales-orders?id=${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        setOrderItems(data.items || []);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    }
  };

  // 编辑功能
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

  const openEditModal = async (orderId: number) => {
    try {
      const res = await fetch(`/api/sales-orders?id=${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setEditingOrder(data);

        // 设置表单数据
        setEditForm({
          logisticsName: data.logistics_name || '',
          logisticsNo: data.logistics_no || '',
          receiver: data.receiver || '',
          phone: data.phone || '',
          paymentStatus: data.payment_status || 'unpaid',
          remark: data.remark || '',
        });

        // 转换现有商品为编辑行，同时获取实时库存
        const rows: EditRow[] = await Promise.all((data.items || []).map(async (item: SalesOrderItem, index: number) => {
          // 获取商品的实时库存
          let currentQuantity = 0;
          let currentUnit = null;
          try {
            const stockRes = await fetch(`/api/stock-items/search?q=${encodeURIComponent(item.item_name)}`);
            if (stockRes.ok) {
              const stockData = await stockRes.json();
              const matchedItem = stockData.find((s: any) => s.id === item.item_id);
              if (matchedItem) {
                currentQuantity = matchedItem.quantity;
                currentUnit = matchedItem.unit;
              }
            }
          } catch (e) {
            console.error('Failed to fetch stock:', e);
          }

          return {
            id: `edit-row-${index}-${Date.now()}`,
            item: {
              id: item.item_id,
              sku: '',
              name: item.item_name,
              category_id: item.category_id,
              category_name: item.category_name,
              condition_id: item.condition_id,
              condition_name: item.condition_name,
              quantity: currentQuantity,
              unit: currentUnit,
            },
            itemId: item.item_id?.toString() || '',
            originalItemId: item.item_id,
            originalConditionId: item.condition_id,
            conditionId: item.condition_id?.toString() || '',
            searchQuery: item.item_name,
            quantity: item.quantity.toString(),
            unitPrice: item.unit_price.toString(),
            remark: item.remark || '',
            showDropdown: false,
            searchResults: [],
            searching: false,
          };
        }));

        setEditItems(rows);
        await fetchConditions();
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch order for edit:', error);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingOrder(null);
    setEditItems([]);
    setEditForm({
      logisticsName: '',
      logisticsNo: '',
      receiver: '',
      phone: '',
      paymentStatus: 'unpaid',
      remark: '',
    });
  };

  const updateEditRow = (id: string, updates: Partial<EditRow>) => {
    setEditItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const addEditRow = () => {
    const newRow: EditRow = {
      id: `edit-row-${Date.now()}-${Math.random()}`,
      item: null,
      itemId: '',
      originalItemId: null,
      originalConditionId: null,
      conditionId: '',
      searchQuery: '',
      quantity: '',
      unitPrice: '',
      remark: '',
      showDropdown: false,
      searchResults: [],
      searching: false,
    };
    setEditItems((prev) => [...prev, newRow]);
  };

  const removeEditRow = (id: string) => {
    if (editItems.length > 1) {
      setEditItems((prev) => prev.filter((row) => row.id !== id));
    }
  };

  const searchEditItems = async (rowId: string, query: string) => {
    if (query.length < 1) {
      updateEditRow(rowId, { searchResults: [], showDropdown: false });
      return;
    }

    updateEditRow(rowId, { searching: true });

    try {
      const res = await fetch(`/api/stock-items/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        const availableItems = data.filter((item: StockItem) => item.quantity > 0);
        updateEditRow(rowId, {
          searchResults: availableItems,
          showDropdown: true,
          searching: false,
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      updateEditRow(rowId, { searching: false });
    }
  };

  const selectEditItem = (rowId: string, selectedItem: StockItem) => {
    updateEditRow(rowId, {
      item: selectedItem,
      itemId: selectedItem.id.toString(),
      searchQuery: selectedItem.name || '',
      conditionId: selectedItem.condition_id?.toString() || '',
      showDropdown: false,
      searchResults: [],
    });
  };

  // 搜索防抖
  useEffect(() => {
    const timers: { [key: string]: NodeJS.Timeout } = {};

    editItems.forEach((row) => {
      if (row.searchQuery && row.searchQuery.length > 0 && !row.item) {
        if (timers[row.id]) {
          clearTimeout(timers[row.id]);
        }
        timers[row.id] = setTimeout(() => {
          searchEditItems(row.id, row.searchQuery);
        }, 300);
      }
    });

    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItems.map(r => r.searchQuery).join(',')]);

  // 计算编辑后的总金额
  const calculateEditTotal = () => {
    return editItems.reduce((sum, row) => {
      const qty = parseInt(row.quantity) || 0;
      const price = parseFloat(row.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  };

  const handleEditSubmit = async () => {
    const validItems = editItems.filter(
      (row) => row.item && row.quantity && parseInt(row.quantity) > 0
    );

    if (validItems.length === 0) {
      alert('请至少填写一条完整的销售记录');
      return;
    }

    // 检查库存
    for (const row of validItems) {
      const qty = parseInt(row.quantity);
      // 如果商品或数量没变，不需要检查
      if (row.item && row.originalItemId === row.item.id && row.originalConditionId?.toString() === row.conditionId) {
        continue;
      }
      if (row.item && qty > row.item.quantity) {
        alert(`出库数量不能超过库存: ${row.item.name}，库存 ${row.item.quantity}`);
        return;
      }
    }

    setEditLoading(true);
    try {
      const res = await fetch('/api/sales-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: editingOrder?.id,
          logisticsName: editForm.logisticsName,
          logisticsNo: editForm.logisticsNo,
          receiver: editForm.receiver,
          phone: editForm.phone,
          paymentStatus: editForm.paymentStatus,
          remark: editForm.remark,
          items: validItems.map((row) => ({
            itemId: row.item!.id,
            quantity: parseInt(row.quantity),
            conditionId: row.conditionId ? parseInt(row.conditionId) : null,
            unitPrice: parseFloat(row.unitPrice) || 0,
            remark: row.remark.trim(),
          })),
        }),
      });

      if (res.ok) {
        alert('销售单编辑成功');
        closeEditModal();
        fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || '编辑失败');
      }
    } catch (error) {
      console.error('Edit sales order failed:', error);
      alert('编辑失败');
    } finally {
      setEditLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return `¥${price.toFixed(2)}`;
  };

  // 导出为图片
  const orderDetailRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const exportToImage = async () => {
    if (!orderDetailRef.current) return;

    setExporting(true);
    // 临时隐藏导出按钮和关闭按钮
    const exportBtn = document.getElementById('export-btn');
    const closeBtn = document.getElementById('close-btn');
    if (exportBtn) exportBtn.classList.add('hidden');
    if (closeBtn) closeBtn.classList.add('hidden');

    try {
      const canvas = await html2canvas(orderDetailRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `销售单_${selectedOrder?.order_no || selectedOrder?.id}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败');
    } finally {
      // 恢复显示按钮
      if (exportBtn) exportBtn.classList.remove('hidden');
      if (closeBtn) closeBtn.classList.remove('hidden');
      setExporting(false);
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
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">销售单</h1>
          <button
            onClick={() => router.push('/sales-orders/new')}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            新建销售单
          </button>
        </div>

        {/* 搜索表单 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-600 mb-1">开始日期</label>
              <input
                type="date"
                value={searchForm.startDate}
                onChange={(e) => setSearchForm({ ...searchForm, startDate: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">结束日期</label>
              <input
                type="date"
                value={searchForm.endDate}
                onChange={(e) => setSearchForm({ ...searchForm, endDate: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">物流单号</label>
              <input
                type="text"
                value={searchForm.logisticsNo}
                onChange={(e) => setSearchForm({ ...searchForm, logisticsNo: e.target.value })}
                placeholder="模糊搜索"
                className="px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">收货人</label>
              <input
                type="text"
                value={searchForm.receiver}
                onChange={(e) => setSearchForm({ ...searchForm, receiver: e.target.value })}
                placeholder="模糊搜索"
                className="px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">联系电话</label>
              <input
                type="text"
                value={searchForm.phone}
                onChange={(e) => setSearchForm({ ...searchForm, phone: e.target.value })}
                placeholder="模糊搜索"
                className="px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">付款状态</label>
              <select
                value={searchForm.paymentStatus}
                onChange={(e) => setSearchForm({ ...searchForm, paymentStatus: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">全部</option>
                <option value="paid">已付款</option>
                <option value="unpaid">未付款</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
              >
                搜索
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
              >
                重置
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无销售单</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">订单号</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">物流名称</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">物流单号</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">收货人</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">联系电话</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">总价</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">付款状态</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">操作人</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">{order.order_no || order.id}</td>
                    <td className="px-4 py-3 text-sm">{order.logistics_name || '-'}</td>
                    <td className="px-4 py-3 text-sm">{order.logistics_no || '-'}</td>
                    <td className="px-4 py-3 text-sm">{order.receiver || '-'}</td>
                    <td className="px-4 py-3 text-sm">{order.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-orange-500">
                      {formatPrice(order.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.payment_status === 'paid' ? '已付款' : '未付款'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{order.operator_name || '-'}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewOrder(order.id)}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                        >
                          查看
                        </button>
                        <button
                          onClick={() => openEditModal(order.id)}
                          className="text-green-500 hover:text-green-700 text-sm"
                        >
                          编辑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 详情弹窗 */}
        {showModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6" ref={orderDetailRef}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">销售单详情 {selectedOrder.order_no || `#${selectedOrder.id}`}</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <div className="text-sm text-gray-500">物流名称</div>
                    <div>{selectedOrder.logistics_name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">物流单号</div>
                    <div>{selectedOrder.logistics_no || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">收货人</div>
                    <div>{selectedOrder.receiver || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">联系电话</div>
                    <div>{selectedOrder.phone || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">付款状态</div>
                    <div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {selectedOrder.payment_status === 'paid' ? '已付款' : '未付款'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">操作人</div>
                    <div>{selectedOrder.operator_name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">创建时间</div>
                    <div>{formatDate(selectedOrder.created_at)}</div>
                  </div>
                  {selectedOrder.remark && (
                    <div className="col-span-2">
                      <div className="text-sm text-gray-500">备注</div>
                      <div>{selectedOrder.remark}</div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">商品明细</h3>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-sm">商品名称</th>
                        <th className="px-3 py-2 text-left text-sm">分类</th>
                        <th className="px-3 py-2 text-left text-sm">属性</th>
                        <th className="px-3 py-2 text-right text-sm">数量</th>
                        <th className="px-3 py-2 text-right text-sm">单价</th>
                        <th className="px-3 py-2 text-right text-sm">总价</th>
                        <th className="px-3 py-2 text-left text-sm">备注</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orderItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-sm">{item.item_name}</td>
                          <td className="px-3 py-2 text-sm">{item.category_name || '-'}</td>
                          <td className="px-3 py-2 text-sm">{item.condition_name || '-'}</td>
                          <td className="px-3 py-2 text-sm text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-sm text-right">{formatPrice(item.unit_price)}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium">{formatPrice(item.total_price)}</td>
                          <td className="px-3 py-2 text-sm">{item.remark || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-right font-medium">合计</td>
                        <td className="px-3 py-2 text-right font-bold text-orange-500">
                          {formatPrice(selectedOrder.total_amount)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* 导出按钮 */}
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <button
                    id="export-btn"
                    onClick={exportToImage}
                    disabled={exporting}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {exporting ? '导出中...' : '导出图片'}
                  </button>
                  <button
                    id="close-btn"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 编辑弹窗 */}
        {showEditModal && editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">编辑销售单 {editingOrder.order_no || `#${editingOrder.id}`}</h2>
                  <button
                    onClick={closeEditModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                {/* 订单信息表单 */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium mb-3">订单信息</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">物流名称</label>
                      <input
                        type="text"
                        value={editForm.logisticsName}
                        onChange={(e) => setEditForm({ ...editForm, logisticsName: e.target.value })}
                        placeholder="如：顺丰速运"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">物流单号</label>
                      <input
                        type="text"
                        value={editForm.logisticsNo}
                        onChange={(e) => setEditForm({ ...editForm, logisticsNo: e.target.value })}
                        placeholder="快递单号"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">收货人</label>
                      <input
                        type="text"
                        value={editForm.receiver}
                        onChange={(e) => setEditForm({ ...editForm, receiver: e.target.value })}
                        placeholder="收货人姓名"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">联系电话</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="手机号"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">付款状态</label>
                      <select
                        value={editForm.paymentStatus}
                        onChange={(e) => setEditForm({ ...editForm, paymentStatus: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="unpaid">未付款</option>
                        <option value="paid">已付款</option>
                      </select>
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm text-gray-600 mb-1">订单备注</label>
                      <input
                        type="text"
                        value={editForm.remark}
                        onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                        placeholder="订单备注信息"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                  </div>
                </div>

                {/* 商品明细 */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium">商品明细</h3>
                    <button
                      onClick={addEditRow}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      添加商品
                    </button>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full min-w-[900px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-sm font-medium w-40">商品名称 *</th>
                          <th className="px-3 py-2 text-left text-sm font-medium w-24">商品属性</th>
                          <th className="px-3 py-2 text-left text-sm font-medium w-20">分类</th>
                          <th className="px-3 py-2 text-left text-sm font-medium w-20">当前库存</th>
                          <th className="px-3 py-2 text-left text-sm font-medium w-20">出库数量 *</th>
                          <th className="px-3 py-2 text-left text-sm font-medium w-24">销售单价</th>
                          <th className="px-3 py-2 text-left text-sm font-medium w-24">销售总价</th>
                          <th className="px-3 py-2 text-left text-sm font-medium flex-1">备注</th>
                          <th className="px-3 py-2 w-14"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {editItems.map((row) => (
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
                                      updateEditRow(row.id, {
                                        searchQuery: e.target.value,
                                        showDropdown: true,
                                      });
                                    }}
                                    onFocus={() => row.searchResults.length > 0 && updateEditRow(row.id, { showDropdown: true })}
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
                                          selectEditItem(row.id, item);
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
                                  onChange={(e) => updateEditRow(row.id, { conditionId: e.target.value })}
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
                                onChange={(e) => updateEditRow(row.id, { quantity: e.target.value })}
                                placeholder="数量"
                                className="w-24 px-2 py-1.5 border rounded-md text-sm"
                              />
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
                                  onChange={(e) => updateEditRow(row.id, { unitPrice: e.target.value })}
                                  placeholder="0.00"
                                  className="w-24 px-2 py-1.5 border rounded-md text-sm"
                                />
                              </div>
                            </td>

                            {/* 销售总价 */}
                            <td className="px-3 py-2">
                              <span className="text-sm font-semibold text-orange-500">
                                ¥{((parseInt(row.quantity) || 0) * (parseFloat(row.unitPrice) || 0)).toFixed(2)}
                              </span>
                            </td>

                            {/* 备注 */}
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.remark}
                                onChange={(e) => updateEditRow(row.id, { remark: e.target.value })}
                                placeholder="备注"
                                className="w-full px-2 py-1.5 border rounded-md text-sm"
                              />
                            </td>

                            {/* 删除按钮 */}
                            <td className="px-3 py-2">
                              <button
                                onClick={() => removeEditRow(row.id)}
                                className="text-red-500 hover:text-red-700 text-sm"
                                disabled={editItems.length === 1}
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

                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-lg">
                    订单总金额：<span className="text-2xl font-bold text-orange-500">¥{calculateEditTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={closeEditModal}
                      className="px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleEditSubmit}
                      disabled={editLoading}
                      className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                    >
                      {editLoading ? '提交中...' : '保存修改'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
