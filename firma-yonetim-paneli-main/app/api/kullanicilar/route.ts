import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { adminYetki } from "@/lib/yetki";
import { govdeDogrula, hata, ok, prismaHataKodu } from "@/lib/api";
import { kullaniciSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

const guvenliAlanlar = {
  id: true,
  email: true,
  adSoyad: true,
  rol: true,
  izinler: true,
  aktif: true,
  onayDurumu: true,
  calisanId: true,
  calisan: { select: { adSoyad: true } },
  olusturma: true,
} as const;

// GET /api/kullanicilar — firmanın kullanıcıları (firma admini)
export async function GET() {
  const y = await adminYetki();
  if (y.yanit) return y.yanit;

  const kullanicilar = await prisma.kullanici.findMany({
    where: { firmaId: y.firmaId },
    select: guvenliAlanlar,
    orderBy: [{ rol: "asc" }, { id: "asc" }],
  });
  return ok(kullanicilar);
}

// POST /api/kullanicilar — yeni kullanıcı + izin haritası (firma admini)
export async function POST(istek: Request) {
  const y = await adminYetki();
  if (y.yanit) return y.yanit;

  const sonuc = await govdeDogrula(istek, kullaniciSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { kullaniciAdi, adSoyad, sifre, rol, izinler } = sonuc.veri;

  const sifreHash = await bcrypt.hash(sifre, 10);
  try {
    const kullanici = await prisma.kullanici.create({
      data: {
        firmaId: y.firmaId,
        email: kullaniciAdi.toLowerCase().trim(),
        adSoyad,
        sifreHash,
        rol,
        // Admin tüm ekranlara erişir; izin haritası yalnızca rol=kullanici için anlamlı
        izinler: rol === "admin" ? {} : izinler,
      },
      select: guvenliAlanlar,
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "kullanicilar",
      islem: "ekleme",
      hedefTip: "Kullanıcı",
      hedefId: kullanici.id,
      hedefAd: kullanici.email,
      detay: degisiklikOzeti(null, { kullaniciAdi, adSoyad, sifre, rol, izinler }),
    });
    return ok(kullanici, 201);
  } catch (e) {
    if (prismaHataKodu(e) === "P2002") return hata("Bu kullanıcı adı zaten kullanılıyor");
    throw e;
  }
}
