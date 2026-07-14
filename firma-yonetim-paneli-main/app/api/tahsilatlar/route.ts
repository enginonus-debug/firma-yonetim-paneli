import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { bugun, govdeDogrula, ok, sayfalama } from "@/lib/api";
import { tahsilatSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

const iliskiler = {
  musteri: { select: { id: true, ad: true } },
  satisFirsati: { select: { id: true, baslik: true } },
};

// Vadesi geçmiş "bekliyor" kayıtlarını otomatik "gecikti" yapar
async function gecikenleriIsaretle(firmaId: number) {
  await prisma.tahsilat.updateMany({
    where: { firmaId, durum: "bekliyor", vadeTarihi: { lt: bugun() } },
    data: { durum: "gecikti" },
  });
}

// GET /api/tahsilatlar?durum=&musteriId=&sayfa=&limit= — tahsilat listesi (sayfalı)
export async function GET(istek: Request) {
  const y = await yetki("tahsilatlar", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  await gecikenleriIsaretle(firmaId);

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
    prisma.tahsilat.count({ where }),
    prisma.tahsilat.findMany({
      where,
      include: iliskiler,
      orderBy: [{ vadeTarihi: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      skip,
      take,
    }),
  ]);

  return ok({ veriler, toplam, sayfa, limit });
}

// POST /api/tahsilatlar — yeni tahsilat (açık borç) kaydı ekler
export async function POST(istek: Request) {
  const y = await yetki("tahsilatlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, tahsilatSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const veri = sonuc.veri;

  // Vadesi zaten geçmişse doğrudan "gecikti" olarak kaydet
  const durum =
    veri.durum === "bekliyor" && veri.vadeTarihi && veri.vadeTarihi < bugun()
      ? "gecikti"
      : veri.durum;

  const tahsilat = await prisma.tahsilat.create({
    data: { ...veri, durum, firmaId: firmaId },
    include: iliskiler,
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "tahsilatlar",
    islem: "ekleme",
    hedefTip: "Tahsilat",
    hedefId: tahsilat.id,
    hedefAd: tahsilat.musteri.ad,
    detay: degisiklikOzeti(null, { ...veri, durum }),
  });
  return ok(tahsilat, 201);
}
