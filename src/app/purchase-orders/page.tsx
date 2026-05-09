'use client';

import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ProductCondition {
  id: number;
  name: string;
}

interface Category {
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

interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  item_id: number;
  item_name: string;
  category_id: number | null;
  category_name: string | null;
  condition_id: number | null;
  condition_name: string | null;
  good_quantity: number;
  bad_quantity: number;
  unit_price: number;
  total_price: number;
  remark: string;
}

interface PurchaseOrder {
  id: number;
  logistics_name: string;
  logistics_no: string;
  sender: string;
  phone: string;
  total_amount: number;
  status: string;
  operator_id: number;
  operator_name: string;
  remark: string;
  created_at: string;
  items: PurchaseOrderItem[];
}

interface EditItem {
  id: string;
  itemId: number | null;
  itemName: string;
  categoryId: number | null;
  categoryName: string | null;
  conditionId: number | null;
  conditionName: string | null;
  goodQuantity: number;
  badQuantity: number;
  unitPrice: number;
  totalPrice: number;
  remark: string;
  searchQuery: string;
  showDropdown: boolean;
  searchResults: StockItem[];
}

export default function PurchaseOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // 搜索参数
  const [searchParams, setSearchParams] = useState({
    startDate: '',
    endDate: '',
    logisticsNo: '',
    phone: '',
    sender: '',
  });

  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editingOrder, setEditingOrder] = useState<{
    logisticsName: string;
    logisticsNo: string;
    sender: string;
    phone: string;
    remark: string;
    items: EditItem[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // 商品搜索相关
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [searchTimers, setSearchTimers] = useState<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrders();
      fetchConditions();
    }
  }, [session]);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (searchParams.startDate) params.append('startDate', searchParams.startDate);
      if (searchParams.endDate) params.append('endDate', searchParams.endDate);
      if (searchParams.logisticsNo) params.append('logisticsNo', searchParams.logisticsNo);
      if (searchParams.phone) params.append('phone', searchParams.phone);
      if (searchParams.sender) params.append('sender', searchParams.sender);

      const res = await fetch(`/api/purchase-orders?${params}`);
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

  // 处理订单搜索
  const handleOrderSearch = () => {
    setLoading(true);
    fetchOrders();
  };

  // 重置搜索
  const handleResetSearch = () => {
    setSearchParams({
      startDate: '',
      endDate: '',
      logisticsNo: '',
      phone: '',
      sender: '',
    });
    setLoading(true);
    fetchOrders();
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

  // 导出为图片
  const exportToImage = async () => {
    if (!contentRef.current) return;

    try {
      // 隐藏按钮
      const buttons = contentRef.current.querySelectorAll('.export-buttons');
      buttons.forEach((btn: any) => btn.style.display = 'none');

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      // 恢复按钮
      buttons.forEach((btn: any) => btn.style.display = '');

      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      const logisticsName = selectedOrder?.logistics_name || '';
      const logisticsNo = selectedOrder?.logistics_no || '';
      link.download = `采购单-${selectedOrder?.id}-${logisticsName}-${logisticsNo}-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败');
    }
  };

  // 开始编辑
  const startEditing = (order: PurchaseOrder) => {
    const editItems: EditItem[] = order.items.map((item, idx) => ({
      id: `edit-${idx}-${Date.now()}`,
      itemId: item.item_id,
      itemName: item.item_name,
      categoryId: item.category_id,
      categoryName: item.category_name,
      conditionId: item.condition_id,
      conditionName: item.condition_name,
      goodQuantity: item.good_quantity,
      badQuantity: item.bad_quantity,
      unitPrice: item.unit_price,
      totalPrice: item.total_price,
      remark: item.remark,
      searchQuery: item.item_name,
      showDropdown: false,
      searchResults: [],
    }));

    setEditingOrder({
      logisticsName: order.logistics_name,
      logisticsNo: order.logistics_no,
      sender: order.sender || '',
      phone: order.phone || '',
      remark: order.remark || '',
      items: editItems,
    });
    setIsEditing(true);
  };

  // 取消编辑
  const cancelEditing = () => {
    setIsEditing(false);
    setEditingOrder(null);
  };

  // 更新编辑订单基本信息
  const updateEditingOrder = (field: string, value: string) => {
    if (editingOrder) {
      setEditingOrder({ ...editingOrder, [field]: value });
    }
  };

  // 更新编辑商品
  const updateEditItem = (itemId: string, updates: Partial<EditItem>) => {
    if (editingOrder) {
      const newItems = editingOrder.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      );
      setEditingOrder({ ...editingOrder, items: newItems });
    }
  };

  // 搜索商品
  const handleSearch = async (itemId: string, query: string) => {
    if (!query || query.length === 0) {
      updateEditItem(itemId, { searchResults: [], showDropdown: false });
      return;
    }

    try {
      const res = await fetch(`/api/stock-items/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        updateEditItem(itemId, {
          searchResults: data,
          showDropdown: data.length > 0,
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  // 选择商品
  const selectEditItem = (editItemId: string, selectedItem: StockItem) => {
    updateEditItem(editItemId, {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      categoryId: selectedItem.category_id,
      categoryName: selectedItem.category_name,
      conditionId: selectedItem.condition_id,
      conditionName: selectedItem.condition_name,
      searchQuery: selectedItem.name,
      showDropdown: false,
      searchResults: [],
    });
  };

  // 添加商品行
  const addEditItem = () => {
    if (editingOrder) {
      const newItem: EditItem = {
        id: `edit-${Date.now()}`,
        itemId: null,
        itemName: '',
        categoryId: null,
        categoryName: null,
        conditionId: null,
        conditionName: null,
        goodQuantity: 0,
        badQuantity: 0,
        unitPrice: 0,
        totalPrice: 0,
        remark: '',
        searchQuery: '',
        showDropdown: false,
        searchResults: [],
      };
      setEditingOrder({ ...editingOrder, items: [...editingOrder.items, newItem] });
    }
  };

  // 删除商品行
  const removeEditItem = (itemId: string) => {
    if (editingOrder && editingOrder.items.length > 1) {
      setEditingOrder({
        ...editingOrder,
        items: editingOrder.items.filter((item) => item.id !== itemId),
      });
    }
  };

  // 计算总价
  const calculatePrices = () => {
    if (editingOrder) {
      const newItems = editingOrder.items.map((item) => ({
        ...item,
        totalPrice: item.goodQuantity * item.unitPrice,
      }));
      setEditingOrder({ ...editingOrder, items: newItems });
    }
  };

  // 保存编辑
  const saveEditing = async () => {
    if (!editingOrder || !selectedOrder) return;

    // 验证
    if (!editingOrder.logisticsName.trim() || !editingOrder.logisticsNo.trim()) {
      alert('物流名称和物流单号必填');
      return;
    }

    const validItems = editingOrder.items.filter(
      (item) => item.itemId && item.goodQuantity > 0 && item.conditionId
    );

    if (validItems.length === 0) {
      alert('至少需要一条有效的商品记录');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          logisticsName: editingOrder.logisticsName.trim(),
          logisticsNo: editingOrder.logisticsNo.trim(),
          sender: editingOrder.sender.trim(),
          phone: editingOrder.phone.trim(),
          remark: editingOrder.remark.trim(),
          items: validItems.map((item) => ({
            itemId: item.itemId,
            itemName: item.itemName,
            categoryId: item.categoryId,
            conditionId: item.conditionId,
            goodQuantity: item.goodQuantity,
            badQuantity: item.badQuantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            remark: item.remark,
          })),
        }),
      });

      if (res.ok) {
        alert('采购单更新成功');
        setIsEditing(false);
        setEditingOrder(null);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || '更新失败');
      }
    } catch (error) {
      console.error('Update failed:', error);
      alert('更新失败');
    } finally {
      setSaving(false);
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

  if (!session) {
    return null;
  }

  // 计算总价
  const calculateTotal = () => {
    if (!editingOrder) return 0;
    return editingOrder.items.reduce((sum, item) => sum + (item.goodQuantity * item.unitPrice), 0);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">采购单历史</h1>

        {/* 搜索栏 */}
        <div className="bg-white rounded-lg shadow border p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">开始日期</label>
              <input
                type="date"
                value={searchParams.startDate}
                onChange={(e) => setSearchParams({ ...searchParams, startDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">结束日期</label>
              <input
                type="date"
                value={searchParams.endDate}
                onChange={(e) => setSearchParams({ ...searchParams, endDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">物流单号</label>
              <input
                type="text"
                value={searchParams.logisticsNo}
                onChange={(e) => setSearchParams({ ...searchParams, logisticsNo: e.target.value })}
                placeholder="模糊搜索"
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">寄件人电话</label>
              <input
                type="text"
                value={searchParams.phone}
                onChange={(e) => setSearchParams({ ...searchParams, phone: e.target.value })}
                placeholder="模糊搜索"
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">寄件人姓名</label>
              <input
                type="text"
                value={searchParams.sender}
                onChange={(e) => setSearchParams({ ...searchParams, sender: e.target.value })}
                placeholder="模糊搜索"
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleOrderSearch}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
            >
              搜索
            </button>
            <button
              onClick={handleResetSearch}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
            >
              重置
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">采购单号</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">物流名称</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">物流单号</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">寄件人</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">电话</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">总价</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">操作人</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.length > 0 ? (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono">#{order.id}</td>
                      <td className="px-4 py-3 text-sm">{order.logistics_name}</td>
                      <td className="px-4 py-3 text-sm font-mono">{order.logistics_no}</td>
                      <td className="px-4 py-3 text-sm">{order.sender || '-'}</td>
                      <td className="px-4 py-3 text-sm">{order.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        ¥{order.total_amount?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-4 py-3 text-sm">{order.operator_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-500 hover:text-blue-700 text-sm mr-2"
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      暂无采购单记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail/Edit Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div ref={contentRef} className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold">
                    {isEditing ? '编辑采购单' : `采购单详情 #${selectedOrder.id}`}
                  </h2>
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      setIsEditing(false);
                      setEditingOrder(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    &times;
                  </button>
                </div>

                {!isEditing ? (
                  // 查看详情模式
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <div className="text-sm text-gray-500">物流名称</div>
                        <div className="font-medium">{selectedOrder.logistics_name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">物流单号</div>
                        <div className="font-mono">{selectedOrder.logistics_no}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">寄件人</div>
                        <div>{selectedOrder.sender || '-'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">电话</div>
                        <div>{selectedOrder.phone || '-'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">操作人</div>
                        <div>{selectedOrder.operator_name || '-'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">创建时间</div>
                        <div>{new Date(selectedOrder.created_at).toLocaleString('zh-CN')}</div>
                      </div>
                      {selectedOrder.remark && (
                        <div className="col-span-2">
                          <div className="text-sm text-gray-500">备注</div>
                          <div>{selectedOrder.remark}</div>
                        </div>
                      )}
                    </div>

                    <h3 className="font-semibold mb-3">商品明细</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">商品名称</th>
                            <th className="px-3 py-2 text-left font-medium">分类</th>
                            <th className="px-3 py-2 text-left font-medium">属性</th>
                            <th className="px-3 py-2 text-right font-medium">良品数量</th>
                            <th className="px-3 py-2 text-right font-medium">不良品数量</th>
                            <th className="px-3 py-2 text-right font-medium">总数</th>
                            <th className="px-3 py-2 text-right font-medium">单价</th>
                            <th className="px-3 py-2 text-right font-medium">总价</th>
                            <th className="px-3 py-2 text-left font-medium">备注</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedOrder.items?.map((item, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2">{item.item_name}</td>
                              <td className="px-3 py-2 text-gray-600">{item.category_name || '-'}</td>
                              <td className="px-3 py-2 text-gray-600">{item.condition_name || '-'}</td>
                              <td className="px-3 py-2 text-right">{item.good_quantity}</td>
                              <td className="px-3 py-2 text-right">{item.bad_quantity}</td>
                              <td className="px-3 py-2 text-right font-medium">{item.good_quantity + item.bad_quantity}</td>
                              <td className="px-3 py-2 text-right">¥{item.unit_price?.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium">¥{item.total_price?.toFixed(2)}</td>
                              <td className="px-3 py-2 text-gray-500">{item.remark || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={7} className="px-3 py-2 text-right font-medium">合计：</td>
                            <td className="px-3 py-2 text-right font-bold text-green-600">
                              ¥{selectedOrder.total_amount?.toFixed(2)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="flex justify-between items-center mt-6 export-buttons">
                      <button
                        onClick={exportToImage}
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                      >
                        导出图片
                      </button>
                      <button
                        onClick={() => startEditing(selectedOrder)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      >
                        编辑
                      </button>
                    </div>
                  </>
                ) : editingOrder ? (
                  // 编辑模式
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium mb-1">物流名称 *</label>
                        <input
                          type="text"
                          value={editingOrder.logisticsName}
                          onChange={(e) => updateEditingOrder('logisticsName', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">物流单号 *</label>
                        <input
                          type="text"
                          value={editingOrder.logisticsNo}
                          onChange={(e) => updateEditingOrder('logisticsNo', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">寄件人</label>
                        <input
                          type="text"
                          value={editingOrder.sender}
                          onChange={(e) => updateEditingOrder('sender', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">电话</label>
                        <input
                          type="text"
                          value={editingOrder.phone}
                          onChange={(e) => updateEditingOrder('phone', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">备注</label>
                        <input
                          type="text"
                          value={editingOrder.remark}
                          onChange={(e) => updateEditingOrder('remark', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold">商品明细</h3>
                      <button
                        onClick={addEditItem}
                        className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                      >
                        添加商品
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium w-40">商品名称</th>
                            <th className="px-2 py-2 text-left font-medium">分类</th>
                            <th className="px-2 py-2 text-left font-medium w-28">属性</th>
                            <th className="px-2 py-2 text-right font-medium w-20">良品</th>
                            <th className="px-2 py-2 text-right font-medium w-20">不良品</th>
                            <th className="px-2 py-2 text-right font-medium w-20">总数</th>
                            <th className="px-2 py-2 text-right font-medium w-24">单价</th>
                            <th className="px-2 py-2 text-right font-medium w-24">总价</th>
                            <th className="px-2 py-2 text-left font-medium">备注</th>
                            <th className="px-2 py-2 w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {editingOrder.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-2 py-2">
                                <div className="relative">
                                  {item.itemId ? (
                                    <div className="text-sm">{item.itemName}</div>
                                  ) : (
                                    <input
                                      type="text"
                                      value={item.searchQuery}
                                      onChange={(e) => {
                                        updateEditItem(item.id, { searchQuery: e.target.value });
                                        const timer = setTimeout(() => handleSearch(item.id, e.target.value), 300);
                                      }}
                                      placeholder="搜索商品"
                                      className="w-full px-2 py-1 border rounded-md text-sm"
                                    />
                                  )}
                                  {item.showDropdown && item.searchResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-32 overflow-y-auto">
                                      {item.searchResults.map((si: StockItem) => (
                                        <div
                                          key={si.id}
                                          onClick={() => selectEditItem(item.id, si)}
                                          className="px-2 py-1.5 cursor-pointer hover:bg-gray-50 text-sm border-b last:border-b-0"
                                        >
                                          <div className="font-medium">{si.name}</div>
                                          <div className="text-xs text-gray-500">{si.sku}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-gray-600">{item.categoryName || '-'}</td>
                              <td className="px-2 py-2">
                                <select
                                  value={item.conditionId || ''}
                                  onChange={(e) => updateEditItem(item.id, {
                                    conditionId: e.target.value ? parseInt(e.target.value) : null,
                                    conditionName: conditions.find(c => c.id === parseInt(e.target.value))?.name
                                  })}
                                  className="w-full px-2 py-1 border rounded-md text-sm"
                                >
                                  <option value="">选择属性</option>
                                  {conditions.map((cond) => (
                                    <option key={cond.id} value={cond.id}>{cond.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.goodQuantity}
                                  onChange={(e) => updateEditItem(item.id, { goodQuantity: parseInt(e.target.value) || 0 })}
                                  className="w-full px-2 py-1 border rounded-md text-sm text-right"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.badQuantity}
                                  onChange={(e) => updateEditItem(item.id, { badQuantity: parseInt(e.target.value) || 0 })}
                                  className="w-full px-2 py-1 border rounded-md text-sm text-right"
                                />
                              </td>
                              <td className="px-2 py-2 text-right font-medium">
                                {item.goodQuantity + item.badQuantity}
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9.]*"
                                  value={item.unitPrice}
                                  onChange={(e) => updateEditItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                  className="w-full px-2 py-1 border rounded-md text-sm text-right"
                                />
                              </td>
                              <td className="px-2 py-2 text-right font-medium">
                                ¥{(item.goodQuantity * item.unitPrice).toFixed(2)}
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={item.remark}
                                  onChange={(e) => updateEditItem(item.id, { remark: e.target.value })}
                                  className="w-full px-2 py-1 border rounded-md text-sm"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  onClick={() => removeEditItem(item.id)}
                                  className="text-red-500 hover:text-red-700 text-sm"
                                  disabled={editingOrder.items.length <= 1}
                                >
                                  删除
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={7} className="px-2 py-2 text-right font-medium">合计：</td>
                            <td className="px-2 py-2 text-right font-bold text-green-600">
                              ¥{calculateTotal().toFixed(2)}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="flex justify-between items-center mt-6 export-buttons">
                      <button
                        onClick={calculatePrices}
                        className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        计算总价
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          取消
                        </button>
                        <button
                          onClick={saveEditing}
                          disabled={saving}
                          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                        >
                          {saving ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
