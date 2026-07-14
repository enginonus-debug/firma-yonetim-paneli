import { prisma } from "@/lib/db";
import { aktifKullanici } from "@/lib/yetki";
import { hata, ok } from "@/lib/api";

// GET /api/kullanicilar/secenekler — görev ataması ve teklif onayı için
// seçilebilir kişiler: yalnızca giriş bilgisi olan (panel kullanıcısı),
// aktif ve onaylanmış hesaplar. Giriş paneli olmayan çalışanlar listelenmez.
// Admin olmayan kullanıcılar da görev atayabildiği için adminYetki istenmez;
// yalnızca ad-soyad ve rol gibi zararsız alanlar döner.
export async function GET() {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);
  if (kullanici.rol === "superadmin") {
    return hata("Bu uç firma kullanıcıları içindir", 403);
  }

  const kullanicilar = await prisma.kullanici.findMany({
    where: {
      firmaId: kullanici.firmaId,
      aktif: true,
      onayDurumu: "onaylandi",
      rol: { in: ["admin", "kullanici"] },
    },
    select: { id: true, adSoyad: true, rol: true },
    orderBy: { adSoyad: "asc" },
  });
  return ok(kullanicilar);
}
