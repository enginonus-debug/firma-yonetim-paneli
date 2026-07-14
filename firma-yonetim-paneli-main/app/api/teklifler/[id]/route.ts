import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { teklifSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";
import { teklifIliskileri, teklifTutarlari, type TeklifKalem } from "@/lib/teklif";

type Baglam = { params: Promise<{ id: string }> };

// GET /api/teklifler/:id — teklif detayı (kalemler + ekler + fırsat)
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "okuma");
  if (y.yanit) return y.yanit;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const teklif = await prisma.teklif.findFirst({
    where: { id, firmaId: y.firmaId },
    include: teklifIliskileri,
  });
  if (!teklif) return hata("Teklif bulunamadı", 404);
  return ok(teklif);
}

// PUT /api/teklifler/:id — teklifi günceller. Yalnızca onay beklerken düzenlenebilir;
// karara bağlanmış (onaylı/reddedilmiş) teklif değiştirilemez.
export async function PUT(istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, teklifSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { satisFirsatiId, onaylayanId, kalemler, kdvOrani, iskontoOrani, ...alanlar } = sonuc.veri;

  const eski = await prisma.teklif.findFirst({ where: { id, firmaId } });
  if (!eski) return hata("Teklif bulunamadı", 404);
  if (eski.durum !== "onay_bekliyor") {
    return hata("Karara bağlanmış teklif düzenlenemez", 409);
  }

  const onaylayan = await prisma.kullanici.findFirst({
    where: { id: onaylayanId, firmaId, aktif: true, onayDurumu: "onaylandi", rol: "admin" },
    select: { id: true },
  });
  if (!onaylayan) return hata("Onaya gönderilecek yönetici geçersiz");

  const { araToplam, toplam } = teklifTutarlari(kalemler as TeklifKalem[], kdvOrani, iskontoOrani);

  try {
    const teklif = await prisma.teklif.update({
      where: { id, firmaId },
      data: { satisFirsatiId, onaylayanId, kalemler, kdvOrani, iskontoOrani, araToplam, toplam, ...alanlar },
      include: teklifIliskileri,
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "teklifler",
      islem: "guncelleme",
      hedefTip: "Fiyat Teklifi",
      hedefId: teklif.id,
      hedefAd: teklif.baslik,
      detay: degisiklikOzeti(eski, { baslik: teklif.baslik, toplam, onaylayanId }),
    });
    return ok(teklif);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Teklif bulunamadı", 404);
    throw e;
  }
}

// DELETE /api/teklifler/:id — teklifi siler (ekler cascade ile temizlenir).
// Karara bağlanmış (onaylı/reddedilmiş) teklifi yalnızca teklifi oluşturan
// veya kararı veren (onaylayan) silebilir; başka kimse müdahale edemez.
export async function DELETE(_istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const eski = await prisma.teklif.findFirst({ where: { id, firmaId } });
  if (!eski) return hata("Teklif bulunamadı", 404);
  if (eski.durum !== "onay_bekliyor") {
    const silebilir = y.kullanici.id === eski.olusturanId || y.kullanici.id === eski.onaylayanId;
    if (!silebilir) {
      return hata("Karara bağlanmış teklifi yalnızca oluşturan veya onaylayan silebilir", 403);
    }
  }

  try {
    await prisma.teklif.delete({ where: { id, firmaId } });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "teklifler",
      islem: "silme",
      hedefTip: "Fiyat Teklifi",
      hedefId: id,
      hedefAd: eski.baslik,
    });
    return ok({ mesaj: "Teklif silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Teklif bulunamadı", 404);
    throw e;
  }
}
