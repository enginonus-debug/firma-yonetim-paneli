import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { calisanKullaniciSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

// POST /api/calisanlar/:id/kullanici — çalışanı kullanıcı olarak atar.
// Hesap onayDurumu="bekliyor" ile oluşur: admin Kullanıcılar ekranından
// onaylayana kadar giriş YAPAMAZ. Ad soyad çalışan kaydından alınır.
export async function POST(istek: Request, { params }: Baglam) {
  const y = await yetki("calisanlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, calisanKullaniciSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { kullaniciAdi, sifre, izinler } = sonuc.veri;

  const calisan = await prisma.calisan.findFirst({
    where: { id, firmaId: firmaId },
    include: { kullanici: { select: { id: true, onayDurumu: true } } },
  });
  if (!calisan) return hata("Çalışan bulunamadı", 404);
  if (!calisan.aktif) return hata("Pasif çalışana kullanıcı atanamaz");
  if (calisan.kullanici) {
    return hata(
      calisan.kullanici.onayDurumu === "bekliyor"
        ? "Bu çalışan için zaten onay bekleyen bir kullanıcı talebi var"
        : "Bu çalışana zaten bir kullanıcı atanmış",
      409
    );
  }

  const sifreHash = await bcrypt.hash(sifre, 10);
  try {
    const kullanici = await prisma.kullanici.create({
      data: {
        firmaId: firmaId,
        email: kullaniciAdi.toLowerCase().trim(),
        adSoyad: calisan.adSoyad,
        sifreHash,
        rol: "kullanici",
        izinler,
        calisanId: calisan.id,
        onayDurumu: "bekliyor",
      },
      select: { id: true, email: true, adSoyad: true, onayDurumu: true },
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "calisanlar",
      islem: "onay-talebi",
      hedefTip: "Kullanıcı",
      hedefId: kullanici.id,
      hedefAd: `${calisan.adSoyad} (${kullanici.email})`,
      detay: degisiklikOzeti(null, { kullaniciAdi, sifre, izinler }),
    });
    return ok(
      { ...kullanici, mesaj: "Kullanıcı talebi oluşturuldu; admin onayı bekleniyor" },
      201
    );
  } catch (e) {
    if (prismaHataKodu(e) === "P2002") return hata("Bu kullanıcı adı zaten kullanılıyor");
    throw e;
  }
}
