import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { superadminYetki } from "@/lib/yetki";
import { govdeDogrula, hata, ok, prismaHataKodu } from "@/lib/api";
import { yeniFirmaSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

// GET /api/yonetim/firmalar — tüm firmalar + kullanıcıları (süper admin)
export async function GET() {
  const y = await superadminYetki();
  if (y.yanit) return y.yanit;

  const firmalar = await prisma.firma.findMany({ orderBy: { id: "asc" } });
  const kullanicilar = await prisma.kullanici.findMany({
    where: { rol: { not: "superadmin" } },
    select: { id: true, firmaId: true, email: true, adSoyad: true, rol: true, aktif: true },
    orderBy: [{ firmaId: "asc" }, { rol: "asc" }, { id: "asc" }],
  });

  return ok(
    firmalar.map((f) => ({
      ...f,
      kullanicilar: kullanicilar.filter((k) => k.firmaId === f.id),
    }))
  );
}

// POST /api/yonetim/firmalar — yeni firma + firma admini hesabı (süper admin)
export async function POST(istek: Request) {
  const y = await superadminYetki();
  if (y.yanit) return y.yanit;

  const sonuc = await govdeDogrula(istek, yeniFirmaSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { adminKullaniciAdi, adminAdSoyad, adminSifre, ...firmaVerisi } = sonuc.veri;

  const sifreHash = await bcrypt.hash(adminSifre, 10);
  try {
    const olusan = await prisma.$transaction(async (tx) => {
      const firma = await tx.firma.create({ data: firmaVerisi });
      const admin = await tx.kullanici.create({
        data: {
          firmaId: firma.id,
          email: adminKullaniciAdi.toLowerCase().trim(),
          adSoyad: adminAdSoyad,
          sifreHash,
          rol: "admin",
        },
        select: { id: true, email: true, adSoyad: true, rol: true, aktif: true, firmaId: true },
      });
      return { ...firma, kullanicilar: [admin] };
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "yonetim",
      islem: "ekleme",
      hedefTip: "Firma",
      hedefId: olusan.id,
      hedefAd: olusan.ad,
      firmaId: olusan.id,
      detay: degisiklikOzeti(null, { ...firmaVerisi, adminKullaniciAdi, adminAdSoyad, adminSifre }),
    });
    return ok(olusan, 201);
  } catch (e) {
    if (prismaHataKodu(e) === "P2002") {
      const alanlar = (e as { meta?: { target?: string[] } }).meta?.target;
      if (!alanlar || alanlar.includes("email")) {
        return hata("Bu kullanıcı adı zaten kullanılıyor");
      }
    }
    throw e;
  }
}
