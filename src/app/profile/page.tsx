'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
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

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'logs'>('profile');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProfile();
      fetchLogs();
    }
  }, [status]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setName(data.user.name);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/user/logs');
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const handleUpdateName = async () => {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        setEditingName(false);
        fetchProfile();
        update({ name });
      }
    } catch (error) {
      console.error('Failed to update name:', error);
    }
  };

  const handleUpdatePassword = async () => {
    if (password.length < 6) {
      alert('密码至少6个字符');
      return;
    }

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setEditingPassword(false);
        setPassword('');
        alert('密码已更新，请重新登录');
        signOut({ callbackUrl: '/login' });
      }
    } catch (error) {
      console.error('Failed to update password:', error);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="p-8">加载中...</div>;
  }

  if (!session) {
    return <div className="p-8">请先登录</div>;
  }

  const getPermissionLabel = (key: string) => {
    switch (key) {
      case 'canCreate': return '创建';
      case 'canEdit': return '编辑';
      case 'canDelete': return '删除';
      case 'canIn': return '入库';
      case 'canOut': return '出库';
      default: return key;
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">个人中心</h1>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'profile'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('profile')}
          >
            个人信息
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'logs'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            我的操作记录 ({logs.length})
          </button>
        </div>

        {activeTab === 'profile' && user && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">基本信息</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">昵称</label>
                  {editingName ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md"
                      />
                      <button
                        onClick={handleUpdateName}
                        className="px-3 py-2 bg-primary text-white rounded-md"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingName(false);
                          setName(user.name);
                        }}
                        className="px-3 py-2 border rounded-md"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-lg">{user.name}</p>
                      <button
                        onClick={() => setEditingName(true)}
                        className="text-primary hover:underline"
                      >
                        编辑
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-500">用户名</label>
                  <p className="text-lg">{user.username || '-'}</p>
                </div>

                <div>
                  <label className="text-sm text-gray-500">手机号</label>
                  <p className="text-lg">{user.phone || '-'}</p>
                </div>

                <div>
                  <label className="text-sm text-gray-500">角色</label>
                  <p className="text-lg">{user.role === 'admin' ? '管理员' : '普通用户'}</p>
                </div>

                <div>
                  <label className="text-sm text-gray-500">状态</label>
                  <p className="text-lg">
                    {user.status === 'approved' ? '已通过' : user.status === 'pending' ? '待审核' : '已禁用'}
                  </p>
                </div>

                <div>
                  <label className="text-sm text-gray-500">权限</label>
                  <div className="flex gap-2 mt-1">
                    {user.permissions ? (
                      Object.entries(user.permissions).map(([key, value]) => (
                        <span
                          key={key}
                          className={`px-2 py-1 rounded text-xs ${
                            value ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                          }`}
                        >
                          {getPermissionLabel(key)}: {value ? '是' : '否'}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">待审核通过后设置</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">修改密码</h2>
              {editingPassword ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">新密码</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdatePassword}
                      className="px-4 py-2 bg-primary text-white rounded-md"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setEditingPassword(false);
                        setPassword('');
                      }}
                      className="px-4 py-2 border rounded-md"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditingPassword(true)}
                  className="text-primary hover:underline"
                >
                  修改密码
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">时间</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">商品</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">数量变化</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">{log.operation_type}</td>
                    <td className="px-4 py-3 text-sm">{log.item_name || log.sku || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                    </td>
                    <td className="px-4 py-3 text-sm">{log.remark || '-'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      暂无记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
