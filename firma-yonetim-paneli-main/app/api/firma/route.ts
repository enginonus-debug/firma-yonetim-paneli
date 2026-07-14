import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, ok } from "@/lib/api";
import { firmaSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

// GET /api/firma — firma bilgilerini getirir (tek kayıt)
export async function GET() {
  const y = await yetki("firma", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const firma = await prisma.firma.findUnique({ where: { id: firmaId } });
  if (!firma) return hata("Firma kaydı bulunamadı", 404);
  return ok(firma);
}

// PUT /api/firma — firma bilgilerini günceller (yoksa oluşturur)
export async function PUT(istek: Request) {
  const y = await yetki("firma", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, firmaSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const eski = await prisma.firma.findUnique({ where: { id: firmaId } });

  const firma = await prisma.firma.upsert({
    where: { id: firmaId },
    update: sonuc.veri,
    create: { id: firmaId, ...sonuc.veri },
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "firma",
    islem: eski ? "guncelleme" : "ekleme",
    hedefTip: "Firma",
    hedefId: firma.id,
    hedefAd: firma.ad,
    detay: degisiklikOzeti(eski, sonuc.veri),
  });
  return ok(firma);
}
