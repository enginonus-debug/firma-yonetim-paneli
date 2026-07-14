import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { aktifKullanici } from "@/lib/yetki";
import { govdeDogrula, hata, ok } from "@/lib/api";
import { sifreDegistirSemasi } from "@/lib/semalar";
import { denetimKaydet } from "@/lib/denetim";

// POST /api/hesap/sifre — kullanıcının kendi şifresini değiştirmesi
export async function POST(istek: Request) {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);

  const sonuc = await govdeDogrula(istek, sifreDegistirSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { eskiSifre, yeniSifre } = sonuc.veri;

  const dogru = await bcrypt.compare(eskiSifre, kullanici.sifreHash);
  if (!dogru) return hata("Mevcut şifre hatalı");

  const sifreHash = await bcrypt.hash(yeniSifre, 10);
  await prisma.kullanici.update({ where: { id: kullanici.id }, data: { sifreHash } });
  await denetimKaydet({
    kullanici,
    ekran: "hesap",
    islem: "sifre-degistirme",
    hedefTip: "Kullanıcı",
    hedefId: kullanici.id,
    hedefAd: kullanici.email,
  });
  return ok({ basarili: true });
}
