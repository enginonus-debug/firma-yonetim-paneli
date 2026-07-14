import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { denetimKaydet } from "@/lib/denetim";
import { gorevYetkili } from "@/lib/gorev-atama";

type Baglam = { params: Promise<{ id: string; ekId: string }> };

// GET /api/gorevler/:id/ekler/:ekId — ek dosyasını indirir/görüntüler.
// ?goster=1 → tarayıcıda göster (inline), aksi hâlde indir (attachment).
export async function GET(istek: Request, { params }: Baglam) {
  const y = await yetki("gorevler", "okuma");
  if (y.yanit) return y.yanit;

  const p = await params;
  const id = idAl(p.id);
  const ekId = idAl(p.ekId);
  if (!id || !ekId) return hata("Geçersiz id");

  const ek = await prisma.gorevEki.findFirst({
    where: { id: ekId, gorevId: id, firmaId: y.firmaId },
  });
  if (!ek) return hata("Ek bulunamadı", 404);

  const goster = new URL(istek.url).searchParams.get("goster") === "1";
  const govde = new Uint8Array(ek.veri);
  return new Response(govde, {
    status: 200,
    headers: {
      "Content-Type": ek.mimeTip,
      "Content-Length": String(ek.boyut),
      "Content-Disposition": `${goster ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(ek.dosyaAd)}`,
    },
  });
}

// DELETE /api/gorevler/:id/ekler/:ekId — eki siler.
// Ekleri YALNIZCA görevi oluşturan (atayan) silebilir; admin dahil başkası silemez.
export async function DELETE(_istek: Request, { params }: Baglam) {
  const y = await yetki("gorevler", "yazma");
  if (y.yanit) return y.yanit;

  const p = await params;
  const id = idAl(p.id);
  const ekId = idAl(p.ekId);
  if (!id || !ekId) return hata("Geçersiz id");

  const gorev = await prisma.gorev.findFirst({
    where: { id, firmaId: y.firmaId },
    select: { olusturanId: true },
  });
  if (!gorev) return hata("Görev bulunamadı", 404);
  if (!gorevYetkili(gorev, y.kullanici)) {
    return hata("Ekleri yalnızca görevi oluşturan kişi silebilir", 403);
  }

  const ek = await prisma.gorevEki.findFirst({
    where: { id: ekId, gorevId: id, firmaId: y.firmaId },
    select: { id: true, dosyaAd: true },
  });
  if (!ek) return hata("Ek bulunamadı", 404);

  try {
    await prisma.gorevEki.delete({ where: { id: ekId } });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "gorevler",
      islem: "silme",
      hedefTip: "Görev Belgesi",
      hedefId: ekId,
      hedefAd: ek.dosyaAd,
    });
    return ok({ mesaj: "Ek silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Ek bulunamadı", 404);
    throw e;
  }
}
