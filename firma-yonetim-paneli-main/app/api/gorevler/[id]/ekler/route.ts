import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { hata, idAl, ok } from "@/lib/api";
import { TEKLIF_EK_MAKS_BOYUT, TEKLIF_EK_TIPLERI } from "@/lib/semalar";
import { denetimKaydet } from "@/lib/denetim";

type Baglam = { params: Promise<{ id: string }> };

// Görev başına en fazla ek (görev + sonuç belgeleri toplamı)
const GOREV_EK_MAKS_ADET = 15;

function uzanti(ad: string): string {
  const nokta = ad.lastIndexOf(".");
  return nokta >= 0 ? ad.slice(nokta).toLowerCase() : "";
}

// GET /api/gorevler/:id/ekler — görevin eklerinin üst bilgisi (içerik hariç)
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("gorevler", "okuma");
  if (y.yanit) return y.yanit;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const gorev = await prisma.gorev.findFirst({
    where: { id, firmaId: y.firmaId },
    select: { id: true },
  });
  if (!gorev) return hata("Görev bulunamadı", 404);

  const ekler = await prisma.gorevEki.findMany({
    where: { gorevId: id },
    select: {
      id: true,
      tur: true,
      dosyaAd: true,
      mimeTip: true,
      boyut: true,
      yukleyenAd: true,
      olusturma: true,
    },
    orderBy: { id: "asc" },
  });
  return ok(ekler);
}

// POST /api/gorevler/:id/ekler?tur=gorev|sonuc — göreve belge ekler.
// tur=gorev: görev oluşturan/atayan belgesi · tur=sonuc: görevi tamamlayanın
// eklediği sonuç/reçete belgesi. multipart/form-data ile "dosya" alanı gelir.
export async function POST(istek: Request, { params }: Baglam) {
  const y = await yetki("gorevler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const tur = new URL(istek.url).searchParams.get("tur") === "sonuc" ? "sonuc" : "gorev";

  const gorev = await prisma.gorev.findFirst({
    where: { id, firmaId },
    select: { id: true, baslik: true, _count: { select: { ekler: true } } },
  });
  if (!gorev) return hata("Görev bulunamadı", 404);
  if (gorev._count.ekler >= GOREV_EK_MAKS_ADET) {
    return hata(`Bir göreve en fazla ${GOREV_EK_MAKS_ADET} belge eklenebilir`, 409);
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
  const ek = await prisma.gorevEki.create({
    data: {
      firmaId,
      gorevId: id,
      tur,
      dosyaAd: dosya.name,
      mimeTip: dosya.type || beklenenTip,
      boyut: dosya.size,
      veri,
      yukleyenId: y.kullanici.id,
      yukleyenAd: y.kullanici.adSoyad,
    },
    select: { id: true, tur: true, dosyaAd: true, mimeTip: true, boyut: true, yukleyenAd: true, olusturma: true },
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "gorevler",
    islem: "ekleme",
    hedefTip: tur === "sonuc" ? "Görev Sonuç Belgesi" : "Görev Belgesi",
    hedefId: ek.id,
    hedefAd: `${gorev.baslik} · ${dosya.name}`,
  });
  return ok(ek, 201);
}
