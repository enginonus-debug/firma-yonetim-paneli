import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { hata, ok } from "@/lib/api";

// GET /api/devam/rapor?ay=YYYY-MM — aylık devamsızlık raporu (varsayılan: bu ay)
export async function GET(istek: Request) {
  const y = await yetki("devam", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const url = new URL(istek.url);
  const simdi = new Date();
  const varsayilanAy = `${simdi.getFullYear()}-${String(simdi.getMonth() + 1).padStart(2, "0")}`;
  const ay = url.searchParams.get("ay") ?? varsayilanAy;

  if (!/^\d{4}-\d{2}$/.test(ay)) return hata("ay parametresi YYYY-AA biçiminde olmalı");
  const [yil, ayNo] = ay.split("-").map(Number);
  const baslangic = new Date(Date.UTC(yil, ayNo - 1, 1));
  const bitis = new Date(Date.UTC(yil, ayNo, 1));

  const [gruplar, calisanlar] = await Promise.all([
    prisma.devam.groupBy({
      by: ["calisanId", "durum"],
      where: { firmaId: firmaId, tarih: { gte: baslangic, lt: bitis } },
      _count: { _all: true },
    }),
    prisma.calisan.findMany({
      where: { firmaId: firmaId, aktif: true },
      select: { id: true, adSoyad: true },
      orderBy: { adSoyad: "asc" },
    }),
  ]);

  const satirlar = calisanlar.map((c) => {
    const say = (durum: string) =>
      gruplar.find((g) => g.calisanId === c.id && g.durum === durum)?._count._all ?? 0;
    return {
      calisanId: c.id,
      adSoyad: c.adSoyad,
      geldi: say("geldi"),
      gelmedi: say("gelmedi"),
      izinli: say("izinli"),
    };
  });

  return ok({ ay, satirlar });
}
