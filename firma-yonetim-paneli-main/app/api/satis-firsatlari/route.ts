import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, ok, sayfalama } from "@/lib/api";
import { firsatSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

const iliskiler = {
  musteri: { select: { id: true, ad: true } },
  sorumlu: { select: { id: true, adSoyad: true } },
};

// GET /api/satis-firsatlari?durum=&musteriId=&sayfa=&limit= — fırsat listesi (sayfalı)
export async function GET(istek: Request) {
  const y = await yetki("musteriler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const url = new URL(istek.url);
  const durum = url.searchParams.get("durum");
  const musteriId = Number(url.searchParams.get("musteriId")) || undefined;
  const { sayfa, limit, skip, take } = sayfalama(url);

  const where = {
    firmaId: firmaId,
    ...(durum ? { durum } : {}),
    ...(musteriId ? { musteriId } : {}),
  };

  const [toplam, veriler] = await prisma.$transaction([
    prisma.satisFirsati.count({ where }),
    prisma.satisFirsati.findMany({
      where,
      include: iliskiler,
      orderBy: { olusturma: "desc" },
      skip,
      take,
    }),
  ]);

  return ok({ veriler, toplam, sayfa, limit });
}

// POST /api/satis-firsatlari — yeni satış fırsatı ekler
export async function POST(istek: Request) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, firsatSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const firsat = await prisma.satisFirsati.create({
    data: { ...sonuc.veri, firmaId: firmaId },
    include: iliskiler,
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "musteriler",
    islem: "ekleme",
    hedefTip: "Satış Fırsatı",
    hedefId: firsat.id,
    hedefAd: firsat.baslik ?? firsat.musteri.ad,
    detay: degisiklikOzeti(null, sonuc.veri),
  });
  return ok(firsat, 201);
}
