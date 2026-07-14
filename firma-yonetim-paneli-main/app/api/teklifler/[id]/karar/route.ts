import { prisma } from "@/lib/db";
import { adminYetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok } from "@/lib/api";
import { teklifKararSemasi } from "@/lib/semalar";
import { denetimKaydet } from "@/lib/denetim";
import { teklifIliskileri } from "@/lib/teklif";

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

  const teklif = await prisma.teklif.findFirst({ where: { id, firmaId } });
  if (!teklif) return hata("Teklif bulunamadı", 404);
  if (teklif.durum !== "onay_bekliyor") {
    return hata("Bu teklif zaten karara bağlanmış");
  }

  const onaylandi = sonuc.veri.karar === "onayla";
  const guncel = await prisma.teklif.update({
    where: { id, firmaId },
    data: {
      durum: onaylandi ? "onaylandi" : "reddedildi",
      onaylayanId: y.kullanici.id,
      kararNotu: sonuc.veri.kararNotu?.trim() || null,
      kararZamani: new Date(),
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
