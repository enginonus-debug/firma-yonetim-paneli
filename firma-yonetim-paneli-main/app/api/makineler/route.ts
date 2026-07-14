import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, ok } from "@/lib/api";
import { makineSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

// GET /api/makineler?durum=calisiyor|bakimda|arizali — makine listesi
export async function GET(istek: Request) {
  const y = await yetki("makineler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const url = new URL(istek.url);
  const durum = url.searchParams.get("durum");

  const makineler = await prisma.makine.findMany({
    where: {
      firmaId: firmaId,
      ...(durum ? { durum } : {}),
    },
    orderBy: { ad: "asc" },
    include: { sorumlu: { select: { id: true, adSoyad: true, aktif: true } } },
  });
  return ok(makineler);
}

// POST /api/makineler — yeni makine ekler
export async function POST(istek: Request) {
  const y = await yetki("makineler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, makineSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  // Not yalnızca bakım/arıza durumuna aittir; çalışan makinede tutulmaz
  const veri = sonuc.veri;
  if (veri.durum === "calisiyor") veri.durumNotu = null;

  const makine = await prisma.makine.create({
    data: { ...veri, firmaId: firmaId },
  });

  // Bakımda/arızalı olarak eklenen makine için geçmiş kaydı da açılır
  if (makine.durum !== "calisiyor") {
    await prisma.makineOlay.create({
      data: {
        firmaId: firmaId,
        makineId: makine.id,
        tip: makine.durum === "arizali" ? "ariza" : "bakim",
        aciklama: makine.durumNotu ?? "",
        sorumluId: makine.sorumluId,
      },
    });
  }
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "makineler",
    islem: "ekleme",
    hedefTip: "Makine",
    hedefId: makine.id,
    hedefAd: makine.ad,
    detay: degisiklikOzeti(null, veri),
  });
  return ok(makine, 201);
}
