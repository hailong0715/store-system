'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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
  location: string | null;
  description: string | null;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
}

interface ProductCondition {
  id: number;
  name: string;
}

export default function ItemsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockItem, setStockItem] = useState<StockItem | null>(null);
  const [stockType, setStockType] = useState<'in' | 'out'>('in');
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockRemark, setStockRemark] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category_id: '',
    condition_id: '',
    quantity: 0,
    unit: '',
    location: '',
    description: '',
  });

  const permissions = (session?.user as any)?.permissions || {};

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, filterCategory]);

  useEffect(() => {
    if (!showModal) {
      setEditingItem(null);
      setFormData({
        sku: '',
        name: '',
        category_id: '',
        condition_id: '',
        quantity: 0,
        unit: '',
        location: '',
        description: '',
      });
    }
  }, [showModal]);

  useEffect(() => {
    if (!showStockModal) {
      setStockItem(null);
      setStockQuantity('');
      setStockRemark('');
    }
  }, [showStockModal]);

  const fetchData = async () => {
    try {
      const [itemsRes, categoriesRes, conditionsRes] = await Promise.all([
        fetch(`/api/stock-items${filterCategory ? `?categoryId=${filterCategory}` : ''}`),
        fetch('/api/categories'),
        fetch('/api/product-conditions'),
      ]);

      const itemsData = await itemsRes.json();
      const categoriesData = await categoriesRes.json();
      const conditionsData = await conditionsRes.json();

      if (itemsRes.ok) setItems(itemsData);
      if (categoriesRes.ok) setCategories(categoriesData);
      if (conditionsRes.ok) setConditions(conditionsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set('categoryId', filterCategory);
      if (searchTerm) params.set('search', searchTerm);

      const res = await fetch(`/api/stock-items?${params}`);
      const data = await res.json();
      if (res.ok) setItems(data);
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 新建商品时必须选择分类
    if (!editingItem && !formData.category_id) {
      alert('请选择商品分类');
      return;
    }

    const url = editingItem ? `/api/stock-items/${editingItem.id}` : '/api/stock-items';
    const method = editingItem ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          category_id: formData.category_id ? parseInt(formData.category_id) : null,
          condition_id: formData.condition_id ? parseInt(formData.condition_id) : null,
          quantity: parseInt(formData.quantity as any) || 0,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  };

  const handleEdit = (item: StockItem) => {
    setEditingItem(item);
    setFormData({
      sku: item.sku,
      name: item.name,
      category_id: item.category_id?.toString() || '',
      condition_id: item.condition_id?.toString() || '',
      quantity: item.quantity,
      unit: item.unit || '',
      location: item.location || '',
      description: item.description || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此商品吗？')) return;

    try {
      const res = await fetch(`/api/stock-items/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleStockIn = (item: StockItem) => {
    setStockItem(item);
    setStockType('in');
    setShowStockModal(true);
  };

  const handleStockOut = (item: StockItem) => {
    setStockItem(item);
    setStockType('out');
    setShowStockModal(true);
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stockItem || !stockQuantity || parseInt(stockQuantity) <= 0) {
      alert('请输入有效的数量');
      return;
    }

    try {
      const res = await fetch(`/api/stock-items/${stockItem.id}/${stockType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: parseInt(stockQuantity),
          remark: stockRemark,
        }),
      });

      if (res.ok) {
        setShowStockModal(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (error) {
      console.error('Failed to stock in/out:', error);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="p-8">加载中...</div>;
  }

  if (!session) {
    return <div className="p-8">请先登录</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">商品管理</h1>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            新建商品
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="搜索商品名称或产品编码"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">全部分类</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-100 border rounded-md hover:bg-gray-200"
          >
            搜索
          </button>
        </div>

        {/* Items List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">产品编码</th>
                <th className="px-4 py-3 text-left text-sm font-medium">产品名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">分类</th>
                <th className="px-4 py-3 text-left text-sm font-medium">商品属性</th>
                <th className="px-4 py-3 text-left text-sm font-medium">库存</th>
                <th className="px-4 py-3 text-left text-sm font-medium">单位</th>
                <th className="px-4 py-3 text-left text-sm font-medium">位置</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono text-sm">{item.sku}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.category_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{item.condition_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${item.quantity < 10 ? 'text-orange-600' : ''}`}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.unit || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{item.location || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {permissions.canIn && (
                        <button
                          onClick={() => handleStockIn(item)}
                          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          入库
                        </button>
                      )}
                      {permissions.canOut && (
                        <button
                          onClick={() => handleStockOut(item)}
                          className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                        >
                          出库
                        </button>
                      )}
                      {permissions.canEdit && (
                        <button
                          onClick={() => handleEdit(item)}
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          编辑
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    暂无商品，请点击「新建商品」添加
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingItem ? '编辑商品' : '新建商品'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">产品编码 *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="例如：PROD-001"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">产品名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="例如：iPhone 15 Pro"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">分类 *</label>
                  {categories.length === 0 ? (
                    <div className="text-sm text-red-500">
                      暂无分类，请先到分类管理页面新建分类
                    </div>
                  ) : (
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="">选择分类</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!editingItem && categories.length === 0}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingItem ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock In/Out Modal */}
      {showStockModal && stockItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              {stockType === 'in' ? '入库' : '出库'}
            </h2>
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">商品: {stockItem.name}</p>
              <p className="text-sm text-gray-600">产品编码: {stockItem.sku}</p>
              <p className="text-sm text-gray-600">
                当前库存: <span className="font-semibold">{stockItem.quantity}</span> {stockItem.unit || '个'}
              </p>
            </div>
            <form onSubmit={handleStockSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  {stockType === 'in' ? '入库数量' : '出库数量'} *
                </label>
                <input
                  type="number"
                  min="1"
                  max={stockType === 'out' ? stockItem.quantity : undefined}
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="请输入数量"
                  required
                />
                {stockType === 'out' && stockQuantity && parseInt(stockQuantity) > stockItem.quantity && (
                  <p className="text-sm text-red-500 mt-1">出库数量不能超过当前库存</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">备注</label>
                <textarea
                  value={stockRemark}
                  onChange={(e) => setStockRemark(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="可选备注"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={stockType === 'out' && !!stockQuantity && parseInt(stockQuantity) > stockItem.quantity}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认{stockType === 'in' ? '入库' : '出库'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
