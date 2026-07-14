import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string; ekId: string }> };

// GET /api/teklifler/:id/ekler/:ekId — ek dosyasını indirir (içerik).
// ?goster=1 → tarayıcıda göster (inline), aksi hâlde indirme (attachment).
export async function GET(istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "okuma");
  if (y.yanit) return y.yanit;

  const p = await params;
  const id = idAl(p.id);
  const ekId = idAl(p.ekId);
  if (!id || !ekId) return hata("Geçersiz id");

  const ek = await prisma.teklifEki.findFirst({
    where: { id: ekId, teklifId: id, firmaId: y.firmaId },
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

// DELETE /api/teklifler/:id/ekler/:ekId — eki siler
export async function DELETE(_istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;

  const p = await params;
  const id = idAl(p.id);
  const ekId = idAl(p.ekId);
  if (!id || !ekId) return hata("Geçersiz id");

  const ek = await prisma.teklifEki.findFirst({
    where: { id: ekId, teklifId: id, firmaId: y.firmaId },
    select: { id: true, dosyaAd: true },
  });
  if (!ek) return hata("Ek bulunamadı", 404);

  try {
    await prisma.teklifEki.delete({ where: { id: ekId } });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "teklifler",
      islem: "silme",
      hedefTip: "Teklif Eki",
      hedefId: ekId,
      hedefAd: ek.dosyaAd,
    });
    return ok({ mesaj: "Ek silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Ek bulunamadı", 404);
    throw e;
  }
}
