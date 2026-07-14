import { prisma } from "@/lib/db";
import { aktifKullanici } from "@/lib/yetki";
import { hata, ok } from "@/lib/api";

// GET /api/bildirimler — oturumdaki kullanıcının son bildirimleri + okunmamış sayısı.
// Bildirimler kişiseldir; superadmin hariç her firma kullanıcısı kendi uyarılarını görür.
export async function GET() {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);
  if (kullanici.rol === "superadmin") return ok({ veriler: [], okunmamis: 0 });

  const [veriler, okunmamis] = await Promise.all([
    prisma.bildirim.findMany({
      where: { kullaniciId: kullanici.id },
      orderBy: [{ okundu: "asc" }, { olusturma: "desc" }],
      take: 30,
      select: { id: true, tip: true, mesaj: true, gorevId: true, okundu: true, olusturma: true },
    }),
    prisma.bildirim.count({ where: { kullaniciId: kullanici.id, okundu: false } }),
  ]);
  return ok({ veriler, okunmamis });
}

// POST /api/bildirimler — { hepsi: true } ile tüm bildirimleri okundu işaretler
export async function POST(istek: Request) {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);

  const govde = await istek.json().catch(() => ({}));
  if (govde?.hepsi === true) {
    await prisma.bildirim.updateMany({
      where: { kullaniciId: kullanici.id, okundu: false },
      data: { okundu: true },
    });
  }
  return ok({ mesaj: "Okundu işaretlendi" });
}
