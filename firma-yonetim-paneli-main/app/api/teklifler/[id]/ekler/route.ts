import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { hata, idAl, ok } from "@/lib/api";
import { TEKLIF_EK_MAKS_ADET, TEKLIF_EK_MAKS_BOYUT, TEKLIF_EK_TIPLERI } from "@/lib/semalar";
import { denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

function uzanti(ad: string): string {
  const nokta = ad.lastIndexOf(".");
  return nokta >= 0 ? ad.slice(nokta).toLowerCase() : "";
}

// GET /api/teklifler/:id/ekler — teklife bağlı eklerin üst bilgisi (içerik hariç)
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "okuma");
  if (y.yanit) return y.yanit;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const teklif = await prisma.teklif.findFirst({
    where: { id, firmaId: y.firmaId },
    select: { id: true },
  });
  if (!teklif) return hata("Teklif bulunamadı", 404);

  const ekler = await prisma.teklifEki.findMany({
    where: { teklifId: id },
    select: { id: true, dosyaAd: true, mimeTip: true, boyut: true, olusturma: true },
    orderBy: { id: "asc" },
  });
  return ok(ekler);
}

// POST /api/teklifler/:id/ekler — reçete görüntüsü veya maliyet belgesi ekler.
// multipart/form-data ile "dosya" alanı gönderilir (png/jpg/webp/pdf/xml/doc/docx/xls/xlsx).
export async function POST(istek: Request, { params }: Baglam) {
  const y = await yetki("musteriler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const teklif = await prisma.teklif.findFirst({
    where: { id, firmaId },
    select: { id: true, baslik: true, _count: { select: { ekler: true } } },
  });
  if (!teklif) return hata("Teklif bulunamadı", 404);
  if (teklif._count.ekler >= TEKLIF_EK_MAKS_ADET) {
    return hata(`Bir teklife en fazla ${TEKLIF_EK_MAKS_ADET} ek eklenebilir`, 409);
  }

  let form: FormData;
  try {
    form = await istek.formData();
  } catch {
    return hata("Dosya gövdesi okunamadı (multipart/form-data bekleniyor)");
  }
  const dosya = form.get("dosya");
  if (!(dosya instanceof File) || dosya.size === 0) {
    return hata("Geçerli bir dosya gönderin");
  }
  if (dosya.size > TEKLIF_EK_MAKS_BOYUT) {
    return hata(`Dosya en fazla ${Math.round(TEKLIF_EK_MAKS_BOYUT / 1024 / 1024)} MB olabilir`);
  }

  const ext = uzanti(dosya.name);
  const beklenenTip = TEKLIF_EK_TIPLERI[ext];
  if (!beklenenTip) {
    return hata("Desteklenmeyen dosya türü (png, jpg, webp, pdf, xml, doc, docx, xls, xlsx)");
  }

  const veri = Buffer.from(await dosya.arrayBuffer());
  const ek = await prisma.teklifEki.create({
    data: {
      firmaId,
      teklifId: id,
      dosyaAd: dosya.name,
      mimeTip: dosya.type || beklenenTip,
      boyut: dosya.size,
      veri,
    },
    select: { id: true, dosyaAd: true, mimeTip: true, boyut: true, olusturma: true },
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "teklifler",
    islem: "ekleme",
    hedefTip: "Teklif Eki",
    hedefId: ek.id,
    hedefAd: `${teklif.baslik} · ${dosya.name}`,
  });
  return ok(ek, 201);
}
