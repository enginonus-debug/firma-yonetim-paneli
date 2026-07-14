import { prisma } from "@/lib/db";
import { adminYetki } from "@/lib/yetki";
import { hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

// DELETE /api/calisanlar/:id/kalici — pasif çalışanı KALICI olarak siler (admin).
// Yalnızca zaten pasife alınmış (aktif=false) çalışanlar silinebilir.
// İlişkili kayıtlar güvenle temizlenir: devam kayıtları silinir; makine/olay/satış
// sorumluluğu ve bağlı panel hesabı bağlantısı kaldırılır (null yapılır).
export async function DELETE(_istek: Request, { params }: Baglam) {
  const y = await adminYetki();
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const calisan = await prisma.calisan.findFirst({ where: { id, firmaId } });
  if (!calisan) return hata("Çalışan bulunamadı", 404);
  if (calisan.aktif) {
    return hata("Yalnızca pasife alınmış çalışan kalıcı olarak silinebilir");
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Bağlı panel hesabının bağlantısını kaldır (hesap silinmez, ayrı yönetilir)
      await tx.kullanici.updateMany({ where: { calisanId: id }, data: { calisanId: null } });
      // Sorumluluk atıflarını kaldır
      await tx.makine.updateMany({ where: { sorumluId: id }, data: { sorumluId: null } });
      await tx.makineOlay.updateMany({ where: { sorumluId: id }, data: { sorumluId: null } });
      await tx.satisFirsati.updateMany({ where: { sorumluId: id }, data: { sorumluId: null } });
      // Devam (puantaj) kayıtlarını sil
      await tx.devam.deleteMany({ where: { calisanId: id } });
      // Çalışanı sil
      await tx.calisan.delete({ where: { id, firmaId } });
    });

    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "calisanlar",
      islem: "silme",
      hedefTip: "Çalışan (kalıcı)",
      hedefId: id,
      hedefAd: calisan.adSoyad,
    });
    return ok({ mesaj: "Çalışan kalıcı olarak silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Çalışan bulunamadı", 404);
    throw e;
  }
}
