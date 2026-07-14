import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, ok } from "@/lib/api";
import { topluCalisanlarSemasi } from "@/lib/semalar";
import { denetimKaydet } from "@/lib/denetim";

// POST /api/calisanlar/toplu — Excel'den ayrıştırılmış çalışan listesini
// toplu ekler. Gövde: { calisanlar: [ {adSoyad, ...} ] }. Yalnızca ad soyad
// zorunludur; diğer alanlar boş bırakılabilir. Hepsi tek işlemde eklenir.
export async function POST(istek: Request) {
  const y = await yetki("calisanlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, topluCalisanlarSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const veriler = sonuc.veri.calisanlar.map((c) => ({ ...c, firmaId }));

  const olusan = await prisma.calisan.createMany({ data: veriler });

  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "calisanlar",
    islem: "ekleme",
    hedefTip: "Çalışan (toplu)",
    hedefAd: `${olusan.count} çalışan içe aktarıldı`,
    detay: { adet: { eski: null, yeni: olusan.count } },
  });

  return ok({ eklenen: olusan.count }, 201);
}
