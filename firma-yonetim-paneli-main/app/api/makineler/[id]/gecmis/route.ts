import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { hata, idAl, ok } from "@/lib/api";

type Baglam = { params: Promise<{ id: string }> };

// GET /api/makineler/:id/gecmis — makinenin bakım/arıza geçmişi (yeniden eskiye)
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("makineler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const makine = await prisma.makine.findFirst({
    where: { id, firmaId: firmaId },
    select: { id: true, ad: true },
  });
  if (!makine) return hata("Makine bulunamadı", 404);

  const olaylar = await prisma.makineOlay.findMany({
    where: { makineId: id, firmaId: firmaId },
    orderBy: { baslangic: "desc" },
    include: { sorumlu: { select: { adSoyad: true } } },
  });
  return ok({ makine, olaylar });
}
