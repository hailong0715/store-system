'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string | null;
  phone: string | null;
  name: string;
  role: string;
  status: string;
  permissions: any;
  created_at: string;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({
    login: '',
    password: '',
    name: '',
    permissions: {
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canIn: false,
      canOut: false,
    },
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && (session.user as any).role === 'admin') {
      fetchUsers();
      fetchPendingUsers();
    }
  }, [session]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      const res = await fetch('/api/users/pending');
      const data = await res.json();
      if (res.ok) {
        setPendingUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch pending users:', error);
    }
  };

  const handleApprove = async (userId: number, permissions: any) => {
    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });

      if (res.ok) {
        fetchPendingUsers();
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to approve user:', error);
    }
  };

  const handleReject = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/reject`, {
        method: 'POST',
      });

      if (res.ok) {
        fetchPendingUsers();
      }
    } catch (error) {
      console.error('Failed to reject user:', error);
    }
  };

  const handleDisable = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/disable`, {
        method: 'POST',
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to disable user:', error);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('确定要删除此用户吗？')) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        setShowModal(false);
        setNewUser({
          login: '',
          password: '',
          name: '',
          permissions: {
            canCreate: false,
            canEdit: false,
            canDelete: false,
            canIn: false,
            canOut: false,
          },
        });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="p-8">加载中...</div>;
  }

  if (!session || (session.user as any).role !== 'admin') {
    return <div className="p-8">无权限访问</div>;
  }

  const displayUsers = activeTab === 'pending' ? pendingUsers : users;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">用户管理</h1>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            创建用户
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'all'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('all')}
          >
            所有用户 ({users.length})
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'pending'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('pending')}
          >
            待审核 ({pendingUsers.length})
          </button>
        </div>

        {/* User List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">昵称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">登录名</th>
                <th className="px-4 py-3 text-left text-sm font-medium">角色</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium">权限</th>
                <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3">{user.username || user.phone || '-'}</td>
                  <td className="px-4 py-3">{user.role === 'admin' ? '管理员' : '普通用户'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        user.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : user.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.status === 'approved' ? '已通过' : user.status === 'pending' ? '待审核' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.status === 'approved' && (
                      <div className="flex gap-1">
                        {Object.entries(user.permissions || {}).map(([key, value]) => (
                          <span
                            key={key}
                            className={`px-2 py-0.5 rounded text-xs ${
                              value ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                            }`}
                          >
                            {key === 'canCreate' && '创建'}
                            {key === 'canEdit' && '编辑'}
                            {key === 'canDelete' && '删除'}
                            {key === 'canIn' && '入库'}
                            {key === 'canOut' && '出库'}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {activeTab === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleApprove(user.id, {
                              canCreate: true,
                              canEdit: true,
                              canDelete: false,
                              canIn: true,
                              canOut: true,
                            })
                          }
                          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          拒绝
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {user.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleDisable(user.id)}
                              className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                            >
                              {user.status === 'disabled' ? '启用' : '禁用'}
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {displayUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">创建新用户</h2>
            <form onSubmit={handleCreateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">昵称</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">用户名 / 手机号</label>
                <input
                  type="text"
                  value={newUser.login}
                  onChange={(e) => setNewUser({ ...newUser, login: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">密码</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">权限</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(newUser.permissions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            permissions: {
                              ...newUser.permissions,
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      <span className="text-sm">
                        {key === 'canCreate' && '创建商品'}
                        {key === 'canEdit' && '编辑商品'}
                        {key === 'canDelete' && '删除商品'}
                        {key === 'canIn' && '入库'}
                        {key === 'canOut' && '出库'}
                      </span>
                    </label>
                  ))}
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
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
