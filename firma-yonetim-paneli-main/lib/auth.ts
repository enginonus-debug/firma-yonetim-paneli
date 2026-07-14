import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Kullanıcı adı ile giriş",
      credentials: {
        // Alan adı geriye dönük uyumluluk için "email"; kullanıcı adı taşır
        email: { label: "Kullanıcı Adı", type: "text" },
        sifre: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const sifre = credentials?.sifre;
        if (typeof email !== "string" || typeof sifre !== "string") return null;

        const kullanici = await prisma.kullanici.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (!kullanici || !kullanici.aktif) return null;
        // Çalışandan atanan hesap, admin onaylayana kadar giriş yapamaz
        if (kullanici.onayDurumu !== "onaylandi") return null;

        const dogru = await bcrypt.compare(sifre, kullanici.sifreHash);
        if (!dogru) return null;

        // Askıya alınmış firmanın kullanıcıları giriş yapamaz (superadmin hariç)
        if (kullanici.rol !== "superadmin") {
          const firma = await prisma.firma.findUnique({
            where: { id: kullanici.firmaId },
            select: { aktif: true },
          });
          if (!firma?.aktif) return null;
        }

        return {
          id: String(kullanici.id),
          email: kullanici.email,
          name: kullanici.adSoyad,
          firmaId: kullanici.firmaId,
          rol: kullanici.rol,
        };
      },
    }),
  ],
});
