import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, ok, sayfalama } from "@/lib/api";
import { teklifSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";
import { teklifIliskileri, teklifTutarlari, type TeklifKalem } from "@/lib/teklif";

// GET /api/teklifler?durum=&satisFirsatiId=&sayfa=&limit= — teklif listesi
// Teklifler satış fırsatına bağlı olduğundan "musteriler" izni ile erişilir.
export async function GET(istek: Request) {
  const y = await yetki("musteriler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const url = new URL(istek.url);
  const durum = url.searchParams.get("durum");
  const satisFirsatiId = Number(url.searchParams.get("satisFirsatiId")) || undefined;
  const { sayfa, limit, skip, take } = sayfalama(url);

  const where = {
    firmaId,
    ...(durum ? { durum } : {}),
    ...(satisFirsatiId ? { satisFirsatiId } : {}),
  };

  const [toplam, veriler] = await prisma.$transaction([
    prisma.teklif.count({ where }),
    prisma.teklif.findMany({
      where,
      include: teklifIliskileri,
      orderBy: { olusturma: "desc" },
      skip,
      take,
    }),
  ]);

  return ok({ veriler, toplam, sayfa, limit });
}

// POST /api/teklifler — yeni fiyat teklifi oluşturur ve yönetici onayına gönderir
export async function POST(istek: Request) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, teklifSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { satisFirsatiId, onaylayanId, kalemler, kdvOrani, ...alanlar } = sonuc.veri;

  // Fırsat bu firmaya ait mi?
  const firsat = await prisma.satisFirsati.findFirst({
    where: { id: satisFirsatiId, firmaId },
    select: { id: true },
  });
  if (!firsat) return hata("Satış fırsatı bulunamadı", 404);

  // Onaylayan aynı firmada aktif bir yönetici (admin) olmalı
  const onaylayan = await prisma.kullanici.findFirst({
    where: { id: onaylayanId, firmaId, aktif: true, onayDurumu: "onaylandi", rol: "admin" },
    select: { id: true },
  });
  if (!onaylayan) return hata("Onaya gönderilecek yönetici geçersiz");

  const { araToplam, toplam } = teklifTutarlari(kalemler as TeklifKalem[], kdvOrani);

  const teklif = await prisma.teklif.create({
    data: {
      firmaId,
      satisFirsatiId,
      onaylayanId,
      olusturanId: y.kullanici.id,
      kalemler,
      kdvOrani,
      araToplam,
      toplam,
      durum: "onay_bekliyor",
      ...alanlar,
    },
    include: teklifIliskileri,
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "teklifler",
    islem: "ekleme",
    hedefTip: "Fiyat Teklifi",
    hedefId: teklif.id,
    hedefAd: teklif.baslik,
    detay: degisiklikOzeti(null, { baslik: teklif.baslik, toplam, onaylayanId }),
  });
  return ok(teklif, 201);
}
