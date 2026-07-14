import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, ok } from "@/lib/api";
import { gorevSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";
import {
  atamaKayitlari,
  atamalariDogrula,
  gorevGorunurWhere,
  gorevIliskileri,
} from "@/lib/gorev-atama";
import { bildirimGonder } from "@/lib/bildirim";

// GET /api/gorevler?durum=&makineId= — görev listesi (kanban için).
// Kullanıcı yalnızca DAHİL OLDUĞU görevleri görür: oluşturan (atayan), atanan,
// denetçi, kontrolör veya izleyici. Bunlardan biri değilse görev listede çıkmaz.
export async function GET(istek: Request) {
  const y = await yetki("gorevler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const url = new URL(istek.url);
  const durum = url.searchParams.get("durum");
  const makineId = Number(url.searchParams.get("makineId")) || undefined;

  const gorevler = await prisma.gorev.findMany({
    where: {
      ...gorevGorunurWhere(firmaId, y.kullanici.id),
      ...(durum ? { durum } : {}),
      ...(makineId ? { makineId } : {}),
    },
    include: gorevIliskileri,
    orderBy: { olusturma: "desc" },
  });
  return ok(gorevler);
}

// POST /api/gorevler — yeni görev oluşturur (atananlar + denetçi + kontrolör ile)
export async function POST(istek: Request) {
  const y = await yetki("gorevler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, gorevSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { atananlar, denetciId, kontrolorId, izleyiciler, ...alanlar } = sonuc.veri;

  const atamaHatasi = await atamalariDogrula(firmaId, { atananlar, denetciId, kontrolorId, izleyiciler });
  if (atamaHatasi) return hata(atamaHatasi);

  const gorev = await prisma.gorev.create({
    data: {
      ...alanlar,
      firmaId: firmaId,
      olusturanId: y.kullanici.id, // görevi atayan (kısıtlı alanları yalnızca o düzenler)
      atamalar: { create: atamaKayitlari({ atananlar, denetciId, kontrolorId, izleyiciler }) },
    },
    include: gorevIliskileri,
  });

  // İlgili kişilere atama/paylaşım bildirimi gönder (atayanın kendisi hariç)
  const rolAdi: Record<string, string> = {
    atanan: "görevli",
    denetci: "denetçi",
    kontrolor: "kontrolör",
  };
  for (const a of gorev.atamalar) {
    const mesaj =
      a.rol === "izleyici"
        ? `"${gorev.baslik}" görevi görüntülemeniz için sizinle paylaşıldı`
        : `Size "${gorev.baslik}" görevi ${rolAdi[a.rol] ?? "görevli"} olarak atandı`;
    await bildirimGonder(prisma, {
      firmaId,
      kullaniciIdler: [a.kullanici.id],
      tip: "atama",
      mesaj,
      gorevId: gorev.id,
      haric: y.kullanici.id,
    });
  }

  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "gorevler",
    islem: "ekleme",
    hedefTip: "Görev",
    hedefId: gorev.id,
    hedefAd: gorev.baslik,
    detay: degisiklikOzeti(null, { ...alanlar, atananlar, denetciId, kontrolorId }),
  });
  return ok(gorev, 201);
}
