import { prisma } from "@/lib/db";
import { adminYetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok } from "@/lib/api";
import { teklifKararSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";
import { gecmiseEkle, teklifIliskileri, type TeklifAnlikVeri, type TeklifOlay } from "@/lib/teklif";

// PATCH /api/teklifler/:id/karar — yönetici teklifi onaylar veya reddeder.
// Gövde: { karar: "onayla" | "reddet", kararNotu? } (firma admini/yönetici).
// Onaylanınca teklif geçerli hâle gelir ve müşteriye verilebilir/yazdırılabilir.
export async function PATCH(istek: Request, baglam: { params: Promise<{ id: string }> }) {
  const y = await adminYetki();
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await baglam.params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, teklifKararSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const teklif = await prisma.teklif.findFirst({
    where: { id, firmaId },
    include: {
      satisFirsati: {
        select: {
          id: true,
          baslik: true,
          durum: true,
          sorumluId: true,
          tutar: true,
          tarih: true,
          musteri: { select: { ad: true, adres: true, telefon: true, vergiNo: true } },
        },
      },
      olusturan: { select: { adSoyad: true, calisanId: true } },
    },
  });
  if (!teklif) return hata("Teklif bulunamadı", 404);
  if (teklif.durum !== "onay_bekliyor") {
    return hata("Bu teklif zaten karara bağlanmış");
  }

  // Karar anında firma/müşteri/kişi bilgilerini dondur: karara bağlanan teklif,
  // sistemde sonradan yapılan değişikliklerden etkilenmez.
  const firma = await prisma.firma.findUnique({ where: { id: firmaId } });
  const musteri = teklif.satisFirsati.musteri;
  const anlikVeri: TeklifAnlikVeri = {
    firma: {
      ad: firma?.ad ?? "Firma",
      adres: firma?.adres ?? null,
      telefon: firma?.telefon ?? null,
      vergiNo: firma?.vergiNo ?? null,
      logo: firma?.logo ?? null,
    },
    musteri: {
      ad: musteri.ad,
      adres: musteri.adres,
      telefon: musteri.telefon,
      vergiNo: musteri.vergiNo,
    },
    olusturanAd: teklif.olusturan?.adSoyad ?? null,
    onaylayanAd: y.kullanici.adSoyad,
  };

  const onaylandi = sonuc.veri.karar === "onayla";

  // Onaylanan teklif, bağlı satış fırsatını günceller: fırsat bilgileri
  // (başlık, tutar, tarih, sorumlu) teklife göre yazılır; durum yalnızca
  // "potansiyel" ise "görüşülüyor"a çekilir (kazanıldı/kaybedildi kararı
  // kullanıcıda kalır, Müşteriler & Satış ekranından değiştirilebilir).
  if (onaylandi) {
    const firsat = teklif.satisFirsati;
    // tarih @db.Date: UTC'ye çevrilirken gün kaymasın diye yerel takvim günü yazılır
    const bugun = new Date();
    const firsatVerisi = {
      baslik: teklif.baslik,
      tutar: teklif.toplam,
      tarih: new Date(Date.UTC(bugun.getFullYear(), bugun.getMonth(), bugun.getDate())),
      ...(teklif.olusturan?.calisanId ? { sorumluId: teklif.olusturan.calisanId } : {}),
      ...(firsat.durum === "potansiyel" ? { durum: "gorusuluyor" } : {}),
    };
    await prisma.satisFirsati.update({
      where: { id: firsat.id, firmaId },
      data: firsatVerisi,
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "musteriler",
      islem: "guncelleme",
      hedefTip: "Satış Fırsatı",
      hedefId: firsat.id,
      hedefAd: teklif.baslik,
      detay: degisiklikOzeti(
        { baslik: firsat.baslik, tutar: firsat.tutar, tarih: firsat.tarih, durum: firsat.durum },
        firsatVerisi
      ),
    });
  }

  // Karar, teklif geçmişine olay olarak yazılır (revizyon izlenebilirliği)
  const kararOlayi: TeklifOlay = {
    tip: onaylandi ? "onay" : "ret",
    zaman: new Date().toISOString(),
    kullaniciAd: y.kullanici.adSoyad,
    toplam: Number(teklif.toplam),
    iskontoOrani: Number(teklif.iskontoOrani),
    aciklama: sonuc.veri.kararNotu?.trim() || null,
  };

  const guncel = await prisma.teklif.update({
    where: { id, firmaId },
    data: {
      durum: onaylandi ? "onaylandi" : "reddedildi",
      onaylayanId: y.kullanici.id,
      kararNotu: sonuc.veri.kararNotu?.trim() || null,
      kararZamani: new Date(),
      gecmis: gecmiseEkle(teklif.gecmis, kararOlayi),
      anlikVeri,
    },
    include: teklifIliskileri,
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "teklifler",
    islem: onaylandi ? "onaylama" : "reddetme",
    hedefTip: "Fiyat Teklifi",
    hedefId: id,
    hedefAd: teklif.baslik,
  });
  return ok({
    mesaj: onaylandi ? "Teklif onaylandı" : "Teklif reddedildi",
    teklif: guncel,
  });
}
