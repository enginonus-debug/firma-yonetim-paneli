import { prisma } from "@/lib/db";
import { adminYetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok } from "@/lib/api";
import { kullaniciOnaySemasi } from "@/lib/semalar";
import { denetimKaydet } from "@/lib/denetim";

// PATCH /api/kullanicilar/:id/onay — onay bekleyen kullanıcı talebini karara bağlar.
// Gövde: { "karar": "onayla" | "reddet" } (firma admini).
// onayla → hesap girişe açılır; reddet → hesap tamamen silinir.
export async function PATCH(istek: Request, baglam: { params: Promise<{ id: string }> }) {
  const y = await adminYetki();
  if (y.yanit) return y.yanit;

  const { id: idParam } = await baglam.params;
  const id = idAl(idParam);
  if (!id) return hata("Geçersiz kullanıcı id'si");

  const sonuc = await govdeDogrula(istek, kullaniciOnaySemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const hedef = await prisma.kullanici.findUnique({
    where: { id },
    include: { calisan: { select: { adSoyad: true } } },
  });
  if (!hedef || hedef.firmaId !== y.firmaId || hedef.rol !== "kullanici") {
    return hata("Kullanıcı bulunamadı", 404);
  }
  if (hedef.onayDurumu !== "bekliyor") {
    return hata("Bu kullanıcı için bekleyen bir onay talebi yok");
  }

  const hedefAd = hedef.calisan
    ? `${hedef.calisan.adSoyad} (${hedef.email})`
    : hedef.email;

  if (sonuc.veri.karar === "onayla") {
    const kullanici = await prisma.kullanici.update({
      where: { id },
      data: { onayDurumu: "onaylandi" },
      select: { id: true, email: true, adSoyad: true, onayDurumu: true },
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "kullanicilar",
      islem: "onaylama",
      hedefTip: "Kullanıcı",
      hedefId: id,
      hedefAd,
    });
    return ok({ mesaj: "Kullanıcı onaylandı; artık giriş yapabilir", kullanici });
  }

  // Reddedilen talep iz bırakmadan hesap tablosunda tutulmaz;
  // izi denetim kaydında kalır
  await prisma.kullanici.delete({ where: { id } });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "kullanicilar",
    islem: "reddetme",
    hedefTip: "Kullanıcı",
    hedefId: id,
    hedefAd,
  });
  return ok({ mesaj: "Talep reddedildi ve hesap silindi" });
}
