'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
    router.refresh();
  };

  const isLoggedIn = status === 'authenticated';
  const isAdmin = (session?.user as any)?.role === 'admin';

  if (status === 'loading') {
    return null;
  }

  if (!isLoggedIn) {
    return (
      <nav className="fixed top-0 right-0 left-0 h-14 bg-white border-b shadow-sm z-50">
        <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-lg">库存管理系统</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-primary hover:underline"
            >
              登录
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed top-0 right-0 left-0 h-14 bg-white border-b shadow-sm z-50">
      <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="font-semibold text-lg">
            库存管理系统
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              控制台
            </Link>
            <Link href="/items" className="text-gray-600 hover:text-gray-900">
              商品管理
            </Link>
            <Link href="/categories" className="text-gray-600 hover:text-gray-900">
              分类管理
            </Link>
            <Link href="/product-conditions" className="text-gray-600 hover:text-gray-900">
              商品属性
            </Link>
            <Link href="/logs" className="text-gray-600 hover:text-gray-900">
              操作日志
            </Link>
            <Link href="/stock-in" className="text-gray-600 hover:text-gray-900">
              商品入库
            </Link>
            <Link href="/stock-out" className="text-gray-600 hover:text-gray-900">
              商品出库
            </Link>
            <Link href="/purchase-order-in" className="text-gray-600 hover:text-gray-900">
              采购单入库
            </Link>
            <Link href="/purchase-orders" className="text-gray-600 hover:text-gray-900">
              采购单历史
            </Link>
            <Link href="/sales-orders" className="text-gray-600 hover:text-gray-900">
              销售单
            </Link>
            {isAdmin && (
              <Link href="/users" className="text-gray-600 hover:text-gray-900">
                用户管理
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/profile"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {session.user?.name}
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm text-red-600 hover:underline"
          >
            退出登录
          </button>
        </div>
      </div>
    </nav>
  );
}
