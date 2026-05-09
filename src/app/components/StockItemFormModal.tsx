'use client';

import { useState, useEffect } from 'react';

interface Category {
  id: number;
  name: string;
}

interface StockItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (item: { id: number; name: string; category_id: number | null; category_name: string | null }) => void;
}

export default function StockItemFormModal({ isOpen, onClose, onSuccess }: StockItemFormModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category_id: '',
    unit: '',
    location: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetch('/api/categories')
        .then((res) => res.json())
        .then((data) => setCategories(data))
        .catch((err) => console.error('Failed to fetch categories:', err));

      setFormData({
        sku: '',
        name: '',
        category_id: '',
        unit: '',
        location: '',
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category_id) {
      alert('请选择商品分类');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/stock-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          category_id: parseInt(formData.category_id),
        }),
      });

      if (res.ok) {
        const newItem = await res.json();
        const category = categories.find((c) => c.id === parseInt(formData.category_id));
        onSuccess({
          id: newItem.id,
          name: newItem.name,
          category_id: newItem.category_id,
          category_name: category?.name || null,
        });
        onClose();
      } else {
        const data = await res.json();
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('Failed to create item:', error);
      alert('创建失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">新建商品</h2>
        <form onSubmit={handleSubmit}>
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
              <div className="text-sm text-red-500">暂无分类，请先创建分类</div>
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
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">单位</label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="例如：个、箱、件"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">存放位置</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="例如：A区-01-03"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || categories.length === 0}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
