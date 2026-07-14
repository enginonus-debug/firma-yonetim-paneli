import { prisma } from "@/lib/db";
import { aktifKullanici } from "@/lib/yetki";
import { hata, ok, sayfalama } from "@/lib/api";

// GET /api/kayitlar?ekran=&islem=&sayfa=&limit= — denetim kayıtları (sayfalı)
// YALNIZCA admin görebilir: firma admini kendi firmasının kayıtlarını,
// süper admin tüm firmaların kayıtlarını (?firmaId= ile daraltılabilir) görür.
// rol=kullanici olan hesaplar bu uca erişemez (403).
export async function GET(istek: Request) {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);
  if (kullanici.rol !== "admin" && kullanici.rol !== "superadmin") {
    return hata("İşlem kayıtlarını yalnızca admin görüntüleyebilir", 403);
  }

  const url = new URL(istek.url);
  const ekran = url.searchParams.get("ekran");
  const islem = url.searchParams.get("islem");
  const { sayfa, limit, skip, take } = sayfalama(url);

  // Firma admini kendi firmasına kilitli; superadmin isterse firma seçebilir
  const firmaIdParam = Number(url.searchParams.get("firmaId")) || undefined;
  const firmaKosulu =
    kullanici.rol === "admin"
      ? { firmaId: kullanici.firmaId }
      : firmaIdParam
        ? { firmaId: firmaIdParam }
        : {};

  const where = {
    ...firmaKosulu,
    ...(ekran ? { ekran } : {}),
    ...(islem ? { islem } : {}),
  };

  const [toplam, veriler] = await prisma.$transaction([
    prisma.denetimKaydi.count({ where }),
    prisma.denetimKaydi.findMany({
      where,
      orderBy: { zaman: "desc" },
      skip,
      take,
    }),
  ]);

  return ok({ veriler, toplam, sayfa, limit });
}
