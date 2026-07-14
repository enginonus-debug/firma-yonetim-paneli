import { prisma } from "@/lib/db";
import { superadminYetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { firmaYonetimSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

// PATCH /api/yonetim/firmalar/:id — askıya al/aktifleştir, ad düzelt (süper admin)
export async function PATCH(istek: Request, baglam: { params: Promise<{ id: string }> }) {
  const y = await superadminYetki();
  if (y.yanit) return y.yanit;

  const { id: idParam } = await baglam.params;
  const id = idAl(idParam);
  if (!id) return hata("Geçersiz firma id'si");

  const sonuc = await govdeDogrula(istek, firmaYonetimSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const eski = await prisma.firma.findUnique({ where: { id } });
  if (!eski) return hata("Firma bulunamadı", 404);

  try {
    const firma = await prisma.firma.update({ where: { id }, data: sonuc.veri });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "yonetim",
      islem: "guncelleme",
      hedefTip: "Firma",
      hedefId: firma.id,
      hedefAd: firma.ad,
      firmaId: firma.id,
      detay: degisiklikOzeti(eski, sonuc.veri),
    });
    return ok(firma);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Firma bulunamadı", 404);
    throw e;
  }
}
