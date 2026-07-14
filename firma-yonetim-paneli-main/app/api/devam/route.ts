import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { bugun, govdeDogrula, gunTarihi, hata, ok, prismaHataKodu } from "@/lib/api";
import { devamSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

// GET /api/devam?tarih=YYYY-MM-DD — günlük kayıtlar (varsayılan: bugün)
// GET /api/devam?ay=YYYY-MM[&calisanId=] — aylık kayıtlar
export async function GET(istek: Request) {
  const y = await yetki("devam", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const url = new URL(istek.url);
  const ay = url.searchParams.get("ay");
  const tarih = url.searchParams.get("tarih");
  const calisanIdParam = url.searchParams.get("calisanId");
  const calisanId = calisanIdParam ? Number(calisanIdParam) : undefined;

  let tarihKosulu: { equals: Date } | { gte: Date; lt: Date };
  if (ay) {
    if (!/^\d{4}-\d{2}$/.test(ay)) return hata("ay parametresi YYYY-AA biçiminde olmalı");
    const [yil, ayNo] = ay.split("-").map(Number);
    tarihKosulu = {
      gte: new Date(Date.UTC(yil, ayNo - 1, 1)),
      lt: new Date(Date.UTC(yil, ayNo, 1)),
    };
  } else if (tarih) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return hata("tarih parametresi YYYY-AA-GG biçiminde olmalı");
    tarihKosulu = { equals: gunTarihi(tarih) };
  } else {
    tarihKosulu = { equals: bugun() };
  }

  const kayitlar = await prisma.devam.findMany({
    where: {
      firmaId: firmaId,
      tarih: tarihKosulu,
      ...(calisanId ? { calisanId } : {}),
    },
    include: { calisan: { select: { id: true, adSoyad: true } } },
    orderBy: [{ tarih: "asc" }, { calisan: { adSoyad: "asc" } }],
  });
  return ok(kayitlar);
}

// POST /api/devam — günlük giriş/çıkış kaydeder (aynı gün için varsa günceller)
export async function POST(istek: Request) {
  const y = await yetki("devam", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, devamSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { calisanId, tarih, durum, girisSaat, cikisSaat } = sonuc.veri;

  // Çalışanın bu firmaya ait olduğunu doğrula
  const calisan = await prisma.calisan.findFirst({
    where: { id: calisanId, firmaId: firmaId },
    select: { id: true },
  });
  if (!calisan) return hata("Çalışan bulunamadı", 404);

  // Denetim kaydı için: aynı güne kayıt var mıydı (ekleme mi güncelleme mi)?
  const eski = await prisma.devam.findUnique({
    where: { calisanId_tarih: { calisanId, tarih: gunTarihi(tarih) } },
  });

  try {
    const kayit = await prisma.devam.upsert({
      where: { calisanId_tarih: { calisanId, tarih: gunTarihi(tarih) } },
      update: { durum, girisSaat, cikisSaat },
      create: {
        firmaId: firmaId,
        calisanId,
        tarih: gunTarihi(tarih),
        durum,
        girisSaat,
        cikisSaat,
      },
      include: { calisan: { select: { id: true, adSoyad: true } } },
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "devam",
      islem: eski ? "guncelleme" : "ekleme",
      hedefTip: "Devam Kaydı",
      hedefId: kayit.id,
      hedefAd: `${kayit.calisan.adSoyad} — ${tarih}`,
      detay: degisiklikOzeti(eski, { durum, girisSaat, cikisSaat }),
    });
    return ok(kayit, 201);
  } catch (e) {
    if (prismaHataKodu(e) === "P2003") return hata("Çalışan bulunamadı", 404);
    throw e;
  }
}
