import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getOne } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        login: { label: "Login", type: "text", placeholder: "Username or phone" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember", type: "boolean" }
      },
      async authorize(credentials) {
        const { login, password } = credentials || {};

        if (!login || !password) {
          throw new Error('Please enter username/phone and password');
        }

        const user = await getOne`SELECT * FROM users WHERE username = ${login} OR phone = ${login}` as any;

        if (!user) {
          throw new Error('User not found');
        }

        if (user.status === 'pending') {
          throw new Error('Account is pending approval');
        }

        if (user.status === 'disabled') {
          throw new Error('Account is disabled');
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          throw new Error('Invalid password');
        }

        return {
          id: user.id.toString(),
          name: user.name,
          email: user.username || user.phone,
          role: user.role,
          permissions: user.permissions ? JSON.parse(user.permissions) : null,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).permissions = token.permissions;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production',
};
