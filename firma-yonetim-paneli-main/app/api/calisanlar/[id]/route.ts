import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { calisanGuncelleSemasi, calisanPasifSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

// GET /api/calisanlar/:id — çalışan detayı
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("calisanlar", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const calisan = await prisma.calisan.findFirst({
    where: { id, firmaId: firmaId },
  });
  if (!calisan) return hata("Çalışan bulunamadı", 404);
  return ok(calisan);
}

// PUT /api/calisanlar/:id — çalışan bilgilerini günceller
export async function PUT(istek: Request, { params }: Baglam) {
  const y = await yetki("calisanlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, calisanGuncelleSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  // Denetim kaydında eski/yeni farkı gösterebilmek için mevcut hâli oku
  const eski = await prisma.calisan.findFirst({ where: { id, firmaId: firmaId } });
  if (!eski) return hata("Çalışan bulunamadı", 404);

  try {
    const calisan = await prisma.calisan.update({
      where: { id, firmaId: firmaId },
      data: sonuc.veri,
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "calisanlar",
      islem: "guncelleme",
      hedefTip: "Çalışan",
      hedefId: calisan.id,
      hedefAd: calisan.adSoyad,
      detay: degisiklikOzeti(eski, sonuc.veri),
    });
    return ok(calisan);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Çalışan bulunamadı", 404);
    throw e;
  }
}

// DELETE /api/calisanlar/:id — çalışanı pasife alır (kayıt silinmez)
// Gövdede işten ayrılma tarihi zorunlu: { "istenAyrilma": "YYYY-MM-DD" }
// Çalışana bağlı panel hesabı varsa o da otomatik kapatılır:
// onay bekleyen talep silinir, onaylı hesap pasife alınır.
export async function DELETE(istek: Request, { params }: Baglam) {
  const y = await yetki("calisanlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, calisanPasifSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const hesap = await prisma.kullanici.findUnique({ where: { calisanId: id } });

  try {
    const calisan = await prisma.$transaction(async (tx) => {
      const guncel = await tx.calisan.update({
        where: { id, firmaId: firmaId },
        data: { aktif: false, istenAyrilma: sonuc.veri.istenAyrilma },
      });
      if (hesap) {
        if (hesap.onayDurumu === "bekliyor") {
          await tx.kullanici.delete({ where: { id: hesap.id } });
        } else {
          await tx.kullanici.update({ where: { id: hesap.id }, data: { aktif: false } });
        }
      }
      return guncel;
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "calisanlar",
      islem: "pasife-alma",
      hedefTip: "Çalışan",
      hedefId: calisan.id,
      hedefAd: calisan.adSoyad,
      detay: {
        ...degisiklikOzeti(null, { istenAyrilma: sonuc.veri.istenAyrilma }),
        ...(hesap
          ? {
              kullaniciHesabi: {
                eski: hesap.email,
                yeni:
                  hesap.onayDurumu === "bekliyor"
                    ? "onay talebi silindi"
                    : "hesap kapatıldı",
              },
            }
          : {}),
      },
    });
    return ok({ mesaj: "Çalışan pasife alındı", calisan });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Çalışan bulunamadı", 404);
    throw e;
  }
}
