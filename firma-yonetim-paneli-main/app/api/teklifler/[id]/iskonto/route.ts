import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok } from "@/lib/api";
import { teklifIskontoSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";
import {
  gecmiseEkle,
  teklifIliskileri,
  teklifTutarlari,
  type TeklifKalem,
  type TeklifOlay,
} from "@/lib/teklif";

// PATCH /api/teklifler/:id/iskonto — ONAYLI teklife müşteri iskontosu girer.
// Gövde: { iskontoOrani, aciklama? }. Teklif yeniden "onay_bekliyor"a düşer,
// revizyon sayısı artar ve geçmişe "revize" olayı yazılır; yönetici tekrar
// onaylayınca teklif yeniden "onaylandi" olur. Bu, karara bağlanmış teklifte
// izin verilen TEK değişikliktir ve yalnızca teklifi oluşturan veya onaylayan
// tarafından yapılabilir.
export async function PATCH(istek: Request, baglam: { params: Promise<{ id: string }> }) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await baglam.params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, teklifIskontoSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { iskontoOrani, aciklama } = sonuc.veri;

  const teklif = await prisma.teklif.findFirst({ where: { id, firmaId } });
  if (!teklif) return hata("Teklif bulunamadı", 404);
  if (teklif.durum !== "onaylandi") {
    return hata("İskonto yalnızca onaylanmış teklife girilebilir", 409);
  }
  const yetkili = y.kullanici.id === teklif.olusturanId || y.kullanici.id === teklif.onaylayanId;
  if (!yetkili) {
    return hata("İskontoyu yalnızca teklifi oluşturan veya onaylayan girebilir", 403);
  }
  const eskiOran = Number(teklif.iskontoOrani);
  if (iskontoOrani === eskiOran) {
    return hata("İskonto oranı mevcut oranla aynı");
  }

  const { araToplam, toplam } = teklifTutarlari(
    teklif.kalemler as unknown as TeklifKalem[],
    Number(teklif.kdvOrani),
    iskontoOrani
  );

  const olay: TeklifOlay = {
    tip: "revize",
    zaman: new Date().toISOString(),
    kullaniciAd: y.kullanici.adSoyad,
    toplam,
    iskontoOrani,
    aciklama:
      aciklama?.trim() ||
      `Müşteri iskontosu %${eskiOran} → %${iskontoOrani} olarak güncellendi`,
  };

  const guncel = await prisma.teklif.update({
    where: { id, firmaId },
    data: {
      iskontoOrani,
      araToplam,
      toplam,
      durum: "onay_bekliyor", // revize teklif yeniden yönetici onayına düşer
      revizyonNo: teklif.revizyonNo + 1,
      gecmis: gecmiseEkle(teklif.gecmis, olay),
      kararNotu: null,
      kararZamani: null,
      anlikVeri: Prisma.DbNull, // donmuş kopya yeni onayda tekrar alınır
    },
    include: teklifIliskileri,
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "teklifler",
    islem: "guncelleme",
    hedefTip: "Fiyat Teklifi",
    hedefId: id,
    hedefAd: `${teklif.baslik} (revize #${guncel.revizyonNo})`,
    detay: degisiklikOzeti(
      { iskontoOrani: eskiOran, toplam: teklif.toplam, durum: teklif.durum },
      { iskontoOrani, toplam, durum: "onay_bekliyor" }
    ),
  });
  return ok({ mesaj: "İskonto girildi; teklif yeniden onaya gönderildi", teklif: guncel });
}
