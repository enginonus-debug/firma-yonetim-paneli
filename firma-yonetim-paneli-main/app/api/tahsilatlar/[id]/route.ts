import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { bugun, govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { tahsilatDurumGuncelleSemasi, tahsilatGuncelleSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

const iliskiler = {
  musteri: { select: { id: true, ad: true } },
  satisFirsati: { select: { id: true, baslik: true } },
};

// GET /api/tahsilatlar/:id — tahsilat detayı
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("tahsilatlar", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const tahsilat = await prisma.tahsilat.findFirst({
    where: { id, firmaId: firmaId },
    include: iliskiler,
  });
  if (!tahsilat) return hata("Tahsilat kaydı bulunamadı", 404);
  return ok(tahsilat);
}

// PUT /api/tahsilatlar/:id — tahsilat kaydını günceller
export async function PUT(istek: Request, { params }: Baglam) {
  const y = await yetki("tahsilatlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, tahsilatGuncelleSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const eski = await prisma.tahsilat.findFirst({ where: { id, firmaId: firmaId } });
  if (!eski) return hata("Tahsilat kaydı bulunamadı", 404);

  try {
    const tahsilat = await prisma.tahsilat.update({
      where: { id, firmaId: firmaId },
      data: sonuc.veri,
      include: iliskiler,
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "tahsilatlar",
      islem: "guncelleme",
      hedefTip: "Tahsilat",
      hedefId: tahsilat.id,
      hedefAd: tahsilat.musteri.ad,
      detay: degisiklikOzeti(eski, sonuc.veri),
    });
    return ok(tahsilat);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Tahsilat kaydı bulunamadı", 404);
    throw e;
  }
}

// PATCH /api/tahsilatlar/:id — durum değiştirir
// "tahsil_edildi" yapılırsa ödeme tarihi otomatik bugün olur
export async function PATCH(istek: Request, { params }: Baglam) {
  const y = await yetki("tahsilatlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, tahsilatDurumGuncelleSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { durum, odemeTarihi, odemeYontemi } = sonuc.veri;

  const eski = await prisma.tahsilat.findFirst({ where: { id, firmaId: firmaId } });
  if (!eski) return hata("Tahsilat kaydı bulunamadı", 404);

  try {
    const tahsilat = await prisma.tahsilat.update({
      where: { id, firmaId: firmaId },
      data: {
        durum,
        odemeTarihi:
          durum === "tahsil_edildi" ? (odemeTarihi ?? bugun()) : null,
        ...(odemeYontemi !== undefined ? { odemeYontemi } : {}),
      },
      include: iliskiler,
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "tahsilatlar",
      islem: "guncelleme",
      hedefTip: "Tahsilat",
      hedefId: tahsilat.id,
      hedefAd: tahsilat.musteri.ad,
      detay: degisiklikOzeti(eski, {
        durum: tahsilat.durum,
        odemeTarihi: tahsilat.odemeTarihi,
        odemeYontemi: tahsilat.odemeYontemi,
      }),
    });
    return ok(tahsilat);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Tahsilat kaydı bulunamadı", 404);
    throw e;
  }
}

// DELETE /api/tahsilatlar/:id — tahsilat kaydını siler
export async function DELETE(_istek: Request, { params }: Baglam) {
  const y = await yetki("tahsilatlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const eski = await prisma.tahsilat.findFirst({
    where: { id, firmaId: firmaId },
    include: { musteri: { select: { ad: true } } },
  });
  if (!eski) return hata("Tahsilat kaydı bulunamadı", 404);

  try {
    await prisma.tahsilat.delete({ where: { id, firmaId: firmaId } });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "tahsilatlar",
      islem: "silme",
      hedefTip: "Tahsilat",
      hedefId: id,
      hedefAd: `${eski.musteri.ad} — ${eski.tutar.toNumber()} TL`,
    });
    return ok({ mesaj: "Tahsilat kaydı silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Tahsilat kaydı bulunamadı", 404);
    throw e;
  }
}
