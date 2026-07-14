import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { DETAY_PAROLASI, govdeDogrula, hata, idAl, ok } from "@/lib/api";
import { calisanDetaySemasi } from "@/lib/semalar";
import { denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

// POST /api/calisanlar/:id/detay — özel bilgileri parola karşılığında döndürür
// Gövde: { "parola": "..." } — yanlışsa 403.
export async function POST(istek: Request, { params }: Baglam) {
  const y = await yetki("calisanlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, calisanDetaySemasi);
  if (sonuc.yanit) return sonuc.yanit;

  if (sonuc.veri.parola !== DETAY_PAROLASI) {
    return hata("Bu kısmı görme yetkiniz bulunmamaktadır", 403);
  }

  const calisan = await prisma.calisan.findFirst({
    where: { id, firmaId: firmaId },
  });
  if (!calisan) return hata("Çalışan bulunamadı", 404);

  // Özel bilgilere (maaş, TC, adres...) erişim de ayak izi bırakır
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "calisanlar",
    islem: "ozel-bilgi-goruntuleme",
    hedefTip: "Çalışan",
    hedefId: calisan.id,
    hedefAd: calisan.adSoyad,
  });
  return ok(calisan);
}
