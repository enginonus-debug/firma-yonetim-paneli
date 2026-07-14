import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, ok, sayfalama } from "@/lib/api";
import { musteriSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

// GET /api/musteriler?arama=&sayfa=&limit= — müşteri listesi (sayfalı)
export async function GET(istek: Request) {
  const y = await yetki("musteriler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const url = new URL(istek.url);
  const arama = url.searchParams.get("arama")?.trim();
  const { sayfa, limit, skip, take } = sayfalama(url);

  const where = {
    firmaId: firmaId,
    ...(arama
      ? {
          OR: [
            { ad: { contains: arama, mode: "insensitive" as const } },
            { telefon: { contains: arama } },
            { email: { contains: arama, mode: "insensitive" as const } },
            { yetkiliAd: { contains: arama, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [toplam, veriler] = await prisma.$transaction([
    prisma.musteri.count({ where }),
    prisma.musteri.findMany({
      where,
      include: {
        _count: { select: { satisFirsatlari: true, tahsilatlar: true } },
      },
      orderBy: { ad: "asc" },
      skip,
      take,
    }),
  ]);

  return ok({ veriler, toplam, sayfa, limit });
}

// POST /api/musteriler — yeni müşteri ekler
export async function POST(istek: Request) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, musteriSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const musteri = await prisma.musteri.create({
    data: { ...sonuc.veri, firmaId: firmaId },
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "musteriler",
    islem: "ekleme",
    hedefTip: "Müşteri",
    hedefId: musteri.id,
    hedefAd: musteri.ad,
    detay: degisiklikOzeti(null, sonuc.veri),
  });
  return ok(musteri, 201);
}
