import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { makineGuncelleSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

// GET /api/makineler/:id — makine detayı
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("makineler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const makine = await prisma.makine.findFirst({
    where: { id, firmaId: firmaId },
  });
  if (!makine) return hata("Makine bulunamadı", 404);
  return ok(makine);
}

// PUT /api/makineler/:id — makine bilgilerini / durumunu günceller.
// Durum değişikliklerini geçmişe (MakineOlay) işler:
//   çalışıyor -> bakımda/arızalı : yeni olay açılır
//   bakımda/arızalı -> çalışıyor : açık olay kapanır
//   aynı durumda not değişirse   : açık olayın açıklaması güncellenir
export async function PUT(istek: Request, { params }: Baglam) {
  const y = await yetki("makineler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, makineGuncelleSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  // Makine tekrar çalışır duruma alınırsa bakım/arıza notu temizlenir
  const veri = sonuc.veri;
  if (veri.durum === "calisiyor") veri.durumNotu = null;

  const mevcut = await prisma.makine.findFirst({ where: { id, firmaId: firmaId } });
  if (!mevcut) return hata("Makine bulunamadı", 404);

  try {
    const makine = await prisma.$transaction(async (tx) => {
      const guncel = await tx.makine.update({
        where: { id, firmaId: firmaId },
        data: veri,
        include: { sorumlu: { select: { id: true, adSoyad: true, aktif: true } } },
      });

      if (veri.durum && veri.durum !== mevcut.durum) {
        await tx.makineOlay.updateMany({
          where: { makineId: id, bitis: null },
          data: { bitis: new Date() },
        });
        if (veri.durum !== "calisiyor") {
          await tx.makineOlay.create({
            data: {
              firmaId: firmaId,
              makineId: id,
              tip: veri.durum === "arizali" ? "ariza" : "bakim",
              aciklama: veri.durumNotu ?? "",
              sorumluId: guncel.sorumluId,
            },
          });
        }
      } else if (
        veri.durum &&
        veri.durum !== "calisiyor" &&
        veri.durumNotu &&
        veri.durumNotu !== mevcut.durumNotu
      ) {
        await tx.makineOlay.updateMany({
          where: { makineId: id, bitis: null },
          data: { aciklama: veri.durumNotu },
        });
      }

      return guncel;
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "makineler",
      islem: "guncelleme",
      hedefTip: "Makine",
      hedefId: makine.id,
      hedefAd: makine.ad,
      detay: degisiklikOzeti(mevcut, veri),
    });
    return ok(makine);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Makine bulunamadı", 404);
    throw e;
  }
}

// DELETE /api/makineler/:id — makineyi siler (bağlı görev varsa engellenir)
export async function DELETE(_istek: Request, { params }: Baglam) {
  const y = await yetki("makineler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const mevcut = await prisma.makine.findFirst({
    where: { id, firmaId: firmaId },
    select: { ad: true, _count: { select: { gorevler: true } } },
  });
  if (!mevcut) return hata("Makine bulunamadı", 404);
  if (mevcut._count.gorevler > 0) {
    return hata("Bu makineye bağlı görevler var; önce görevleri güncelleyin", 409);
  }

  try {
    await prisma.makine.delete({ where: { id, firmaId: firmaId } });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "makineler",
      islem: "silme",
      hedefTip: "Makine",
      hedefId: id,
      hedefAd: mevcut.ad,
    });
    return ok({ mesaj: "Makine silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Makine bulunamadı", 404);
    throw e;
  }
}
