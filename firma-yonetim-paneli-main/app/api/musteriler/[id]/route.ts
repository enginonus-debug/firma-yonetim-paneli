import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { musteriGuncelleSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

// GET /api/musteriler/:id — müşteri detayı (fırsatları ve tahsilatlarıyla)
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const musteri = await prisma.musteri.findFirst({
    where: { id, firmaId: firmaId },
    include: {
      satisFirsatlari: {
        include: { sorumlu: { select: { id: true, adSoyad: true } } },
        orderBy: { olusturma: "desc" },
      },
      tahsilatlar: { orderBy: { vadeTarihi: "asc" } },
    },
  });
  if (!musteri) return hata("Müşteri bulunamadı", 404);
  return ok(musteri);
}

// PUT /api/musteriler/:id — müşteri bilgilerini günceller
export async function PUT(istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, musteriGuncelleSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const eski = await prisma.musteri.findFirst({ where: { id, firmaId: firmaId } });
  if (!eski) return hata("Müşteri bulunamadı", 404);

  try {
    const musteri = await prisma.musteri.update({
      where: { id, firmaId: firmaId },
      data: sonuc.veri,
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "musteriler",
      islem: "guncelleme",
      hedefTip: "Müşteri",
      hedefId: musteri.id,
      hedefAd: musteri.ad,
      detay: degisiklikOzeti(eski, sonuc.veri),
    });
    return ok(musteri);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Müşteri bulunamadı", 404);
    throw e;
  }
}

// DELETE /api/musteriler/:id — müşteriyi siler (ilişkili kayıt varsa engellenir)
export async function DELETE(_istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const mevcut = await prisma.musteri.findFirst({
    where: { id, firmaId: firmaId },
    select: { ad: true, _count: { select: { satisFirsatlari: true, tahsilatlar: true } } },
  });
  if (!mevcut) return hata("Müşteri bulunamadı", 404);
  if (mevcut._count.satisFirsatlari > 0 || mevcut._count.tahsilatlar > 0) {
    return hata(
      "Bu müşteriye bağlı satış fırsatı veya tahsilat kayıtları var; önce onları silin",
      409
    );
  }

  try {
    await prisma.musteri.delete({ where: { id, firmaId: firmaId } });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "musteriler",
      islem: "silme",
      hedefTip: "Müşteri",
      hedefId: id,
      hedefAd: mevcut.ad,
    });
    return ok({ mesaj: "Müşteri silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Müşteri bulunamadı", 404);
    throw e;
  }
}
