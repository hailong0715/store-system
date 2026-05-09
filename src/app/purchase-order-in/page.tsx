'use client';

import { useState, useEffect, useRef } from 'react';
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

interface PurchaseItem {
  id: string;
  item: StockItem | null;
  originalName: string;
  conditionId: string;
  searchQuery: string;
  goodQuantity: string;
  badQuantity: string;
  totalQuantity: string;
  unitPrice: string;
  totalPrice: string;
  remark: string;
  showDropdown: boolean;
  searchResults: StockItem[];
  showNewProduct: boolean;
}

export default function PurchaseOrderInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [logisticsName, setLogisticsName] = useState('');
  const [logisticsNo, setLogisticsNo] = useState('');
  const [sender, setSender] = useState('');
  const [phone, setPhone] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [grandTotal, setGrandTotal] = useState(0);

  // 新建商品弹窗状态
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductData, setNewProductData] = useState({
    sku: '',
    name: '',
    categoryId: '',
    unit: '',
  });
  const [newProductTargetItemId, setNewProductTargetItemId] = useState<string | null>(null);
  const searchTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchConditions();
      fetchCategories();
      // 默认显示5行
      const initialItems: PurchaseItem[] = [];
      for (let i = 0; i < 5; i++) {
        initialItems.push(createEmptyItem());
      }
      setItems(initialItems);
    }
  }, [status]);

  const createEmptyItem = (): PurchaseItem => ({
    id: `item-${Date.now()}-${Math.random()}`,
    item: null,
    originalName: '',
    conditionId: '',
    searchQuery: '',
    goodQuantity: '',
    badQuantity: '',
    totalQuantity: '',
    unitPrice: '',
    totalPrice: '',
    remark: '',
    showDropdown: false,
    searchResults: [],
    showNewProduct: false,
  });

  // 搜索商品（带防抖）
  const handleSearch = (itemId: string, query: string) => {
    // 清除之前的 timer
    if (searchTimers.current[itemId]) {
      clearTimeout(searchTimers.current[itemId]);
    }

    if (!query || query.length === 0) {
      updateItem(itemId, { searchResults: [], showDropdown: false, showNewProduct: false });
      return;
    }

    // 设置新的 timer
    searchTimers.current[itemId] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock-items/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          updateItem(itemId, {
            searchResults: data,
            showDropdown: data.length > 0,
            showNewProduct: data.length === 0,
          });
        }
      } catch (error) {
        console.error('Search failed:', error);
      }
    }, 300);
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

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setCalculated(false);
    }
  };

  const updateItem = (id: string, updates: Partial<PurchaseItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    setCalculated(false);
  };

  // 自动计算总数
  useEffect(() => {
    items.forEach((item) => {
      const good = parseInt(item.goodQuantity) || 0;
      const bad = parseInt(item.badQuantity) || 0;
      const total = good + bad;
      if (item.totalQuantity !== total.toString()) {
        updateItem(item.id, { totalQuantity: total.toString() });
      }
    });
  }, [items.map(i => i.goodQuantity + i.badQuantity).join(',')]);

  const selectItem = (itemId: string, selectedItem: StockItem) => {
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

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              item: newItem,
              originalName: newItem.name || '',
              conditionId: newItem.condition_id?.toString() || '',
              searchQuery: newItem.name || '',
              showDropdown: false,
              searchResults: [],
              showNewProduct: false,
            }
          : item
      )
    );
  };

  // 打开新建商品弹窗
  const openNewProductModal = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    setNewProductTargetItemId(itemId);
    setNewProductData({
      sku: `SKU-${Date.now()}`,
      name: item?.searchQuery || '',
      categoryId: '',
      unit: '个',
    });
    setShowNewProductModal(true);
  };

  // 提交新建商品
  const handleCreateProduct = async () => {
    if (!newProductData.name.trim()) {
      alert('请输入商品名称');
      return;
    }

    try {
      const res = await fetch('/api/stock-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: newProductData.sku,
          name: newProductData.name.trim(),
          category_id: newProductData.categoryId ? parseInt(newProductData.categoryId) : null,
          unit: newProductData.unit,
        }),
      });

      if (res.ok) {
        const newItem = await res.json();
        // 自动选中新建的商品
        if (newProductTargetItemId) {
          selectItem(newProductTargetItemId, newItem);
        }
        setShowNewProductModal(false);
        setNewProductTargetItemId(null);
      } else {
        const data = await res.json();
        alert(data.error || '创建商品失败');
      }
    } catch (error) {
      console.error('Create product failed:', error);
      alert('创建商品失败');
    }
  };

  const calculatePrices = () => {
    let total = 0;
    items.forEach((item) => {
      const goodQty = parseInt(item.goodQuantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const totalPrice = goodQty * unitPrice;
      updateItem(item.id, { totalPrice: totalPrice.toFixed(2) });
      total += totalPrice;
    });
    setGrandTotal(total);
    setCalculated(true);
  };

  const validate = () => {
    if (!logisticsName.trim()) {
      alert('请填写物流名称');
      return false;
    }
    if (!logisticsNo.trim()) {
      alert('请填写物流单号');
      return false;
    }

    const validItems = items.filter(
      (item) => item.item && item.goodQuantity && parseInt(item.goodQuantity) > 0 && item.conditionId
    );

    if (validItems.length === 0) {
      alert('请至少填写一条有效的商品记录');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const validItems = items.filter(
        (item) => item.item && item.goodQuantity && parseInt(item.goodQuantity) > 0 && item.conditionId
      );

      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logisticsName: logisticsName.trim(),
          logisticsNo: logisticsNo.trim(),
          sender: sender.trim(),
          phone: phone.trim(),
          remark: remark.trim(),
          items: validItems.map((item) => ({
            itemId: item.item!.id,
            itemName: item.item!.name,
            categoryId: item.item!.category_id,
            conditionId: parseInt(item.conditionId),
            goodQuantity: parseInt(item.goodQuantity),
            badQuantity: parseInt(item.badQuantity) || 0,
            unitPrice: parseFloat(item.unitPrice) || 0,
            totalPrice: parseFloat(item.totalPrice) || 0,
            remark: item.remark.trim(),
          })),
        }),
      });

      if (res.ok) {
        alert('采购单入库成功');
        // 重置表单
        setLogisticsName('');
        setLogisticsNo('');
        setSender('');
        setPhone('');
        setRemark('');
        // 重置为5行
        const initialItems: PurchaseItem[] = [];
        for (let i = 0; i < 5; i++) {
          initialItems.push(createEmptyItem());
        }
        setItems(initialItems);
        setCalculated(false);
        setGrandTotal(0);
      } else {
        const data = await res.json();
        alert(data.error || '提交失败');
      }
    } catch (error) {
      console.error('Submit failed:', error);
      alert('提交失败');
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
        <h1 className="text-2xl font-bold mb-6">采购单入库</h1>

        {/* 物流信息 */}
        <div className="bg-white rounded-lg shadow border p-4 mb-6">
          <h2 className="font-semibold mb-4">物流信息</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">物流名称 *</label>
              <input
                type="text"
                value={logisticsName}
                onChange={(e) => setLogisticsName(e.target.value)}
                placeholder="例如：顺丰速运"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">物流单号 *</label>
              <input
                type="text"
                value={logisticsNo}
                onChange={(e) => setLogisticsNo(e.target.value)}
                placeholder="快递单号"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">寄件人</label>
              <input
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="发货人姓名"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">电话</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="联系电话"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
        </div>

        {/* 商品表格 */}
        <div className="bg-white rounded-lg shadow border overflow-hidden mb-6">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-semibold">采购商品</h2>
            <button
              onClick={addItem}
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
            >
              添加行
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-medium w-40">商品名称 *</th>
                  <th className="px-3 py-2 text-left text-sm font-medium w-24">分类</th>
                  <th className="px-3 py-2 text-left text-sm font-medium w-28">商品属性 *</th>
                  <th className="px-3 py-2 text-left text-sm font-medium w-20">良品数量 *</th>
                  <th className="px-3 py-2 text-left text-sm font-medium w-20">不良品数量</th>
                  <th className="px-3 py-2 text-left text-sm font-medium w-20">总数</th>
                  <th className="px-3 py-2 text-left text-sm font-medium w-24">单价</th>
                  <th className="px-3 py-2 text-left text-sm font-medium w-24">总价</th>
                  <th className="px-3 py-2 text-left text-sm font-medium flex-1">备注</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id}>
                    {/* 商品名称 */}
                    <td className="px-3 py-2">
                      <div className="relative">
                        {item.item ? (
                          <input
                            type="text"
                            readOnly
                            value={item.item.name || ''}
                            className="w-full px-2 py-1.5 border rounded-md text-sm bg-gray-50"
                          />
                        ) : (
                          <input
                            type="text"
                            value={item.searchQuery}
                            onChange={(e) => {
                              const query = e.target.value;
                              updateItem(item.id, { searchQuery: query });
                              handleSearch(item.id, query);
                            }}
                            onFocus={() => {
                              if (item.searchQuery && item.searchResults.length > 0) {
                                updateItem(item.id, { showDropdown: true });
                              }
                            }}
                            placeholder="搜索商品"
                            className="w-full px-2 py-1.5 border rounded-md text-sm"
                          />
                        )}
                        {!item.item && (
                          <div className="relative">
                            {item.showDropdown && item.searchResults.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {item.searchResults.map((si: StockItem) => (
                                  <div
                                    key={si.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      selectItem(item.id, si);
                                    }}
                                    className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                                  >
                                    <div className="text-sm font-medium">{si.name}</div>
                                    <div className="text-xs text-gray-500">{si.sku}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {item.showNewProduct && item.searchQuery.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
                                <div
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    openNewProductModal(item.id);
                                  }}
                                  className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-blue-600 border-b"
                                >
                                  <div className="text-sm font-medium">+ 新建商品: {item.searchQuery}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 分类 */}
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {item.item?.category_name || '-'}
                    </td>

                    {/* 商品属性 */}
                    <td className="px-3 py-2">
                      {item.item ? (
                        <select
                          value={item.conditionId}
                          onChange={(e) => updateItem(item.id, { conditionId: e.target.value })}
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
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* 良品数量 */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={item.goodQuantity}
                        onChange={(e) => updateItem(item.id, { goodQuantity: e.target.value })}
                        placeholder="数量"
                        className="w-full px-2 py-1.5 border rounded-md text-sm"
                      />
                    </td>

                    {/* 不良品数量 */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={item.badQuantity}
                        onChange={(e) => updateItem(item.id, { badQuantity: e.target.value })}
                        placeholder="数量"
                        className="w-full px-2 py-1.5 border rounded-md text-sm"
                      />
                    </td>

                    {/* 总数 */}
                    <td className="px-3 py-2">
                      <span className="text-sm font-medium">{item.totalQuantity || '0'}</span>
                    </td>

                    {/* 单价 */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })}
                        placeholder="单价"
                        className="w-full px-2 py-1.5 border rounded-md text-sm"
                      />
                    </td>

                    {/* 总价 */}
                    <td className="px-3 py-2">
                      <span className="text-sm font-medium">{item.totalPrice || '-'}</span>
                    </td>

                    {/* 备注 */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.remark}
                        onChange={(e) => updateItem(item.id, { remark: e.target.value })}
                        placeholder="备注"
                        className="w-full px-2 py-1.5 border rounded-md text-sm"
                      />
                    </td>

                    {/* 删除 */}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        disabled={items.length === 1}
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

        {/* 备注和操作 */}
        <div className="flex justify-between items-start">
          <div className="flex-1 mr-4">
            <label className="block text-sm font-medium mb-1">备注</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="采购单备注"
              className="w-full px-3 py-2 border rounded-md"
              rows={2}
            />
          </div>
          <div className="text-right">
            {calculated && (
              <div className="mb-4">
                <span className="text-lg font-semibold">总价合计：</span>
                <span className="text-xl font-bold text-green-600">¥{grandTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={calculatePrices}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                计算总价
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? '提交中...' : '确认入库'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 新建商品弹窗 */}
      {showNewProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">新建商品</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">商品编码 *</label>
                <input
                  type="text"
                  value={newProductData.sku}
                  onChange={(e) => setNewProductData({ ...newProductData, sku: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">商品名称 *</label>
                <input
                  type="text"
                  value={newProductData.name}
                  onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                  placeholder="请输入商品名称"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">分类</label>
                <select
                  value={newProductData.categoryId}
                  onChange={(e) => setNewProductData({ ...newProductData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">选择分类</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">单位</label>
                <input
                  type="text"
                  value={newProductData.unit}
                  onChange={(e) => setNewProductData({ ...newProductData, unit: e.target.value })}
                  placeholder="例如：个、箱、件"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowNewProductModal(false);
                  setNewProductTargetItemId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateProduct}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                创建并使用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
