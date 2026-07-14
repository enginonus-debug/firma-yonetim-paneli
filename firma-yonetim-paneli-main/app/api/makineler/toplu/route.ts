import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, ok } from "@/lib/api";
import { topluMakinelerSemasi } from "@/lib/semalar";
import { denetimKaydet } from "@/lib/denetim";

// İsim eşlemesi için normalleştirme (Türkçe küçük harf + boşluk sadeleştirme)
function isimNormal(s: string) {
  return s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}

// POST /api/makineler/toplu — Excel'den ayrıştırılmış makine listesini toplu ekler.
// Gövde: { makineler: [ {ad, model?, seriNo?, durum?, durumNotu?, sorumlu?} ] }.
// Yalnızca ad zorunludur; sorumlu bir isimdir ve aktif çalışanlarla eşleştirilir.
export async function POST(istek: Request) {
  const y = await yetki("makineler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, topluMakinelerSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  // Sorumlu isimlerini aktif çalışanlarla eşlemek için harita
  const calisanlar = await prisma.calisan.findMany({
    where: { firmaId, aktif: true },
    select: { id: true, adSoyad: true },
  });
  const isimHarita = new Map(calisanlar.map((c) => [isimNormal(c.adSoyad), c.id]));

  const veriler = sonuc.veri.makineler.map((m) => {
    const { sorumlu, ...alanlar } = m;
    const sorumluId = sorumlu ? isimHarita.get(isimNormal(sorumlu)) ?? null : null;
    // Not yalnızca bakım/arıza durumuna aittir; çalışan makinede tutulmaz
    const durumNotu = alanlar.durum === "calisiyor" ? null : alanlar.durumNotu ?? null;
    return { ...alanlar, durumNotu, sorumluId, firmaId };
  });

  const olusan = await prisma.makine.createMany({ data: veriler });

  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "makineler",
    islem: "ekleme",
    hedefTip: "Makine (toplu)",
    hedefAd: `${olusan.count} makine içe aktarıldı`,
    detay: { adet: { eski: null, yeni: olusan.count } },
  });

  return ok({ eklenen: olusan.count }, 201);
}
