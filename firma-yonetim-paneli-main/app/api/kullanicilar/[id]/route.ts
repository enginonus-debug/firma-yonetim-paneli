import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { adminYetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { kullaniciGuncelleSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

// PATCH /api/kullanicilar/:id — izin/aktiflik/ad/şifre güncelle (firma admini).
// Yalnızca kendi firmasının rol=kullanici hesapları değiştirilebilir;
// admin kendi hesabını veya başka adminleri buradan değiştiremez.
export async function PATCH(istek: Request, baglam: { params: Promise<{ id: string }> }) {
  const y = await adminYetki();
  if (y.yanit) return y.yanit;

  const { id: idParam } = await baglam.params;
  const id = idAl(idParam);
  if (!id) return hata("Geçersiz kullanıcı id'si");

  const hedef = await prisma.kullanici.findUnique({ where: { id } });
  // Kendi firmasının kullanıcı/admin hesapları düzenlenebilir (superadmin hariç).
  // Admin kendi hesabını buradan değiştiremez (yanlışlıkla yetki kaybını önler).
  if (
    !hedef ||
    hedef.firmaId !== y.firmaId ||
    (hedef.rol !== "kullanici" && hedef.rol !== "admin")
  ) {
    return hata("Kullanıcı bulunamadı", 404);
  }
  if (hedef.id === y.kullanici.id) {
    return hata("Kendi hesabınızın yetkisini buradan değiştiremezsiniz");
  }

  const sonuc = await govdeDogrula(istek, kullaniciGuncelleSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { sifre, rol, izinler, ...alanlar } = sonuc.veri;

  // Admine yükseltilince izin haritası temizlenir; kullanıcıya indirilince
  // gönderilen izinler uygulanır.
  const yeniRol = rol ?? hedef.rol;
  const kullanici = await prisma.kullanici.update({
    where: { id },
    data: {
      ...alanlar,
      ...(rol ? { rol } : {}),
      ...(izinler !== undefined ? { izinler: yeniRol === "admin" ? {} : izinler } : {}),
      ...(sifre ? { sifreHash: await bcrypt.hash(sifre, 10) } : {}),
    },
    select: { id: true, email: true, adSoyad: true, rol: true, izinler: true, aktif: true },
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "kullanicilar",
    islem: "guncelleme",
    hedefTip: "Kullanıcı",
    hedefId: kullanici.id,
    hedefAd: kullanici.email,
    detay: degisiklikOzeti(hedef, {
      ...alanlar,
      ...(rol ? { rol } : {}),
      ...(sifre ? { sifre } : {}),
    }),
  });
  return ok(kullanici);
}

// DELETE /api/kullanicilar/:id — pasif kullanıcıyı KALICI olarak siler (admin).
// Yalnızca zaten pasif (aktif=false) hesaplar silinebilir; superadmin ve kişinin
// kendi hesabı silinemez. İlişkili görev atamaları/bildirimler/notlar birlikte
// temizlenir; oluşturduğu teklif/görev kayıtları "oluşturan" bilgisi boşalarak korunur.
export async function DELETE(_istek: Request, baglam: { params: Promise<{ id: string }> }) {
  const y = await adminYetki();
  if (y.yanit) return y.yanit;

  const id = idAl((await baglam.params).id);
  if (!id) return hata("Geçersiz kullanıcı id'si");

  const hedef = await prisma.kullanici.findUnique({ where: { id } });
  if (
    !hedef ||
    hedef.firmaId !== y.firmaId ||
    (hedef.rol !== "kullanici" && hedef.rol !== "admin")
  ) {
    return hata("Kullanıcı bulunamadı", 404);
  }
  if (hedef.id === y.kullanici.id) {
    return hata("Kendi hesabınızı silemezsiniz");
  }
  if (hedef.aktif) {
    return hata("Yalnızca pasif (aktif olmayan) kullanıcı kalıcı olarak silinebilir");
  }

  try {
    await prisma.kullanici.delete({ where: { id } });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "kullanicilar",
      islem: "silme",
      hedefTip: "Kullanıcı (kalıcı)",
      hedefId: id,
      hedefAd: hedef.email,
    });
    return ok({ mesaj: "Kullanıcı kalıcı olarak silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Kullanıcı bulunamadı", 404);
    throw e;
  }
}
