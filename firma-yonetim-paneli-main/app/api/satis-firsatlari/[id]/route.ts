import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { firsatDurumSemasi, firsatGuncelleSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

const iliskiler = {
  musteri: { select: { id: true, ad: true } },
  sorumlu: { select: { id: true, adSoyad: true } },
};

// GET /api/satis-firsatlari/:id — fırsat detayı
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const firsat = await prisma.satisFirsati.findFirst({
    where: { id, firmaId: firmaId },
    include: {
      ...iliskiler,
      tahsilatlar: true,
      teklifler: {
        include: {
          ekler: { select: { id: true, dosyaAd: true, mimeTip: true, boyut: true } },
          onaylayan: { select: { adSoyad: true } },
          olusturan: { select: { adSoyad: true } },
        },
        orderBy: { olusturma: "desc" },
      },
    },
  });
  if (!firsat) return hata("Satış fırsatı bulunamadı", 404);
  return ok(firsat);
}

// PUT /api/satis-firsatlari/:id — fırsatı günceller
export async function PUT(istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, firsatGuncelleSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const eski = await prisma.satisFirsati.findFirst({ where: { id, firmaId: firmaId } });
  if (!eski) return hata("Satış fırsatı bulunamadı", 404);

  try {
    const firsat = await prisma.satisFirsati.update({
      where: { id, firmaId: firmaId },
      data: sonuc.veri,
      include: iliskiler,
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "musteriler",
      islem: "guncelleme",
      hedefTip: "Satış Fırsatı",
      hedefId: firsat.id,
      hedefAd: firsat.baslik ?? firsat.musteri.ad,
      detay: degisiklikOzeti(eski, sonuc.veri),
    });
    return ok(firsat);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Satış fırsatı bulunamadı", 404);
    throw e;
  }
}

// PATCH /api/satis-firsatlari/:id — sadece durum değiştirir
// (potansiyel → görüşülüyor → kazanıldı/kaybedildi)
export async function PATCH(istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, firsatDurumSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const eski = await prisma.satisFirsati.findFirst({ where: { id, firmaId: firmaId } });
  if (!eski) return hata("Satış fırsatı bulunamadı", 404);

  // Kaybedildi dışına çıkılırsa kayıp nedeni temizlenir
  const yeniDurum = sonuc.veri.durum;
  const yeniKayipNedeni =
    yeniDurum === "kaybedildi" ? sonuc.veri.kayipNedeni?.trim() || null : null;

  try {
    const firsat = await prisma.satisFirsati.update({
      where: { id, firmaId: firmaId },
      data: { durum: yeniDurum, kayipNedeni: yeniKayipNedeni },
      include: iliskiler,
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "musteriler",
      islem: "guncelleme",
      hedefTip: "Satış Fırsatı",
      hedefId: firsat.id,
      hedefAd: firsat.baslik ?? firsat.musteri.ad,
      detay: degisiklikOzeti(eski, { durum: yeniDurum, kayipNedeni: yeniKayipNedeni }),
    });
    return ok(firsat);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Satış fırsatı bulunamadı", 404);
    throw e;
  }
}

// DELETE /api/satis-firsatlari/:id — fırsatı siler (bağlı tahsilat varsa engellenir)
export async function DELETE(_istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const mevcut = await prisma.satisFirsati.findFirst({
    where: { id, firmaId: firmaId },
    select: { baslik: true, musteri: { select: { ad: true } }, _count: { select: { tahsilatlar: true } } },
  });
  if (!mevcut) return hata("Satış fırsatı bulunamadı", 404);
  if (mevcut._count.tahsilatlar > 0) {
    return hata("Bu fırsata bağlı tahsilat kayıtları var; önce onları silin", 409);
  }

  try {
    await prisma.satisFirsati.delete({ where: { id, firmaId: firmaId } });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "musteriler",
      islem: "silme",
      hedefTip: "Satış Fırsatı",
      hedefId: id,
      hedefAd: mevcut.baslik ?? mevcut.musteri.ad,
    });
    return ok({ mesaj: "Satış fırsatı silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Satış fırsatı bulunamadı", 404);
    throw e;
  }
}
