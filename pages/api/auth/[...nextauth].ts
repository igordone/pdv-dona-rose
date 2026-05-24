import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { query } from "../../../lib/db";

function isTruthy(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";

        if (!email || !password) {
          return null;
        }

        const employeeResult = await query<{
          id: number;
          name: string;
          email: string;
          password_hash: string;
          role: string;
          active: boolean;
        }>(
          "SELECT id, name, email, password_hash, role, active FROM employees WHERE LOWER(email) = LOWER($1) LIMIT 1",
          [email],
        );

        const employee = employeeResult.rows[0];

        if (employee?.active) {
          const validPassword = await compare(password, employee.password_hash);
          if (validPassword) {
            return {
              id: String(employee.id),
              name: employee.name,
              email: employee.email,
              role: employee.role,
            };
          }
        }

        if (
          isTruthy(process.env.ADMIN_EMAIL) &&
          isTruthy(process.env.ADMIN_PASSWORD) &&
          email === process.env.ADMIN_EMAIL?.toLowerCase() &&
          password === process.env.ADMIN_PASSWORD
        ) {
          return {
            id: "env-admin",
            name: "Administrador",
            email,
            role: "admin",
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "employee";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) ?? "employee";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
