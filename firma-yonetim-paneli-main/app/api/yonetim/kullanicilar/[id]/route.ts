import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { superadminYetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok } from "@/lib/api";
import { sifreSifirlaSemasi } from "@/lib/semalar";
import { denetimKaydet } from "@/lib/denetim";

// PATCH /api/yonetim/kullanicilar/:id — şifre sıfırla (süper admin, müdahale için).
// Süper adminler firma kullanıcısı olmadığından bu uçla değiştirilemez.
export async function PATCH(istek: Request, baglam: { params: Promise<{ id: string }> }) {
  const y = await superadminYetki();
  if (y.yanit) return y.yanit;

  const { id: idParam } = await baglam.params;
  const id = idAl(idParam);
  if (!id) return hata("Geçersiz kullanıcı id'si");

  const sonuc = await govdeDogrula(istek, sifreSifirlaSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const hedef = await prisma.kullanici.findUnique({ where: { id } });
  if (!hedef || hedef.rol === "superadmin") return hata("Kullanıcı bulunamadı", 404);

  const sifreHash = await bcrypt.hash(sonuc.veri.sifre, 10);
  await prisma.kullanici.update({ where: { id }, data: { sifreHash } });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "yonetim",
    islem: "sifre-degistirme",
    hedefTip: "Kullanıcı",
    hedefId: hedef.id,
    hedefAd: hedef.email,
    firmaId: hedef.firmaId,
  });
  return ok({ basarili: true });
}
