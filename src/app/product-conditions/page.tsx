'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ProductCondition {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export default function ProductConditionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conditions, setConditions] = useState<ProductCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState<ProductCondition | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchConditions();
    }
  }, [status]);

  const fetchConditions = async () => {
    try {
      const res = await fetch('/api/product-conditions');
      const data = await res.json();
      if (res.ok) {
        setConditions(data);
      }
    } catch (error) {
      console.error('Failed to fetch product conditions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingCondition
      ? `/api/product-conditions/${editingCondition.id}`
      : '/api/product-conditions';
    const method = editingCondition ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingCondition(null);
        setFormData({ name: '', description: '' });
        fetchConditions();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (error) {
      console.error('Failed to save product condition:', error);
    }
  };

  const handleEdit = (condition: ProductCondition) => {
    setEditingCondition(condition);
    setFormData({
      name: condition.name,
      description: condition.description || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此产品属性吗？')) return;

    try {
      const res = await fetch(`/api/product-conditions/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchConditions();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (error) {
      console.error('Failed to delete product condition:', error);
    }
  };

  const openCreateModal = () => {
    setEditingCondition(null);
    setFormData({ name: '', description: '' });
    setShowModal(true);
  };

  if (status === 'loading' || loading) {
    return <div className="p-8">加载中...</div>;
  }

  if (!session) {
    return <div className="p-8">请先登录</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">产品属性管理</h1>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            新建属性
          </button>
        </div>

        {/* Product Conditions List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">属性名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {conditions.map((condition) => (
                <tr key={condition.id}>
                  <td className="px-4 py-3 font-medium">{condition.name}</td>
                  <td className="px-4 py-3 text-gray-500">{condition.description || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(condition.created_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(condition)}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(condition.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {conditions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    暂无产品属性，请点击「新建属性」添加
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              {editingCondition ? '编辑属性' : '新建属性'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">属性名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="例如：准新、二手、全新"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="可选描述"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCondition(null);
                  }}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  {editingCondition ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
