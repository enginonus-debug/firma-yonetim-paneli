import type { NextAuthConfig } from "next-auth";

// Prisma içermeyen auth ayarları. Rota koruması proxy.ts'de (getToken ile),
// Credentials provider'ı lib/auth.ts içinde eklenir (Prisma gerektirdiği için).
export const authConfig = {
  // Yerel ağdan (localhost dışı bir IP ile, ör. http://192.168.x.x:3000)
  // erişilebilmesi için gerekli; aksi hâlde Auth.js "UntrustedHost" hatası verir.
  trustHost: true,
  pages: {
    signIn: "/giris",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.firmaId = user.firmaId;
        token.rol = user.rol;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (typeof token.firmaId === "number") session.user.firmaId = token.firmaId;
      if (typeof token.rol === "string") session.user.rol = token.rol;
      return session;
    },
  },
} satisfies NextAuthConfig;
