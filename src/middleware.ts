import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    /*
     * 匹配所有需要认证的路径
     * 排除登录、注册等公开页面
     */
    '/((?!login|register|api/auth|api/init|favicon.ico|fonts).*)',
  ],
};
