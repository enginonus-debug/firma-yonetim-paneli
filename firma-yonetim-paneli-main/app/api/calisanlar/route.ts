import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { bugun, govdeDogrula, ok } from "@/lib/api";
import { calisanSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";
import { toplamIzinHakki, yillikIzinHakki } from "@/lib/izin";

// GET /api/calisanlar?aktif=true|false — çalışan listesi (parametresiz: hepsi)
// Özel bilgiler (TC, doğum tarihi, maaş, adres, acil telefon, engel durumu)
// listede dönmez; parola ile /api/calisanlar/:id/detay üzerinden alınır.
// Her kayda yıllık izin bilgisi eklenir: izinHakki, kullanilanIzin, kalanIzin.
// Kullanılan izin = içinde bulunulan izin yılında (işe girişin son yıldönümünden
// bugüne) "gelmedi" veya "izinli" işlenen gün sayısı.
export async function GET(istek: Request) {
  const y = await yetki("calisanlar", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const url = new URL(istek.url);
  const aktifParam = url.searchParams.get("aktif");

  const simdi = bugun();

  const calisanlar = await prisma.calisan.findMany({
    where: {
      firmaId: firmaId,
      ...(aktifParam === "true" ? { aktif: true } : {}),
      ...(aktifParam === "false" ? { aktif: false } : {}),
    },
    include: { kullanici: { select: { email: true, onayDurumu: true, aktif: true } } },
    orderBy: { adSoyad: "asc" },
  });

  // Kullanılan izin, işe başlamadan bugüne kadar "izinli" işlenen tüm günlerdir.
  // (Birikimli hak ile karşılaştırıldığından tüm hizmet süresi taranır.)
  const baslangiclar = new Map<number, Date>();
  for (const c of calisanlar) {
    if (c.iseBaslama) baslangiclar.set(c.id, c.iseBaslama);
  }

  const kullanilanGunler = new Map<number, number>();
  if (baslangiclar.size > 0) {
    const enEski = new Date(
      Math.min(...[...baslangiclar.values()].map((t) => t.getTime()))
    );
    const kayitlar = await prisma.devam.findMany({
      where: {
        firmaId: firmaId,
        calisanId: { in: [...baslangiclar.keys()] },
        durum: "izinli",
        tarih: { gte: enEski, lte: simdi },
      },
      select: { calisanId: true },
    });
    for (const k of kayitlar) {
      kullanilanGunler.set(k.calisanId, (kullanilanGunler.get(k.calisanId) ?? 0) + 1);
    }
  }

  return ok(
    calisanlar.map((c) => {
      // izinHakki = tüm hizmet süresi boyunca hak edilen toplam (birikimli) izin
      const izinHakki = toplamIzinHakki(c.iseBaslama, c.dogumTarihi, simdi);
      const guncelYilHakki = yillikIzinHakki(c.iseBaslama, c.dogumTarihi, simdi);
      const kullanilanIzin = kullanilanGunler.get(c.id) ?? 0;
      return {
        id: c.id,
        adSoyad: c.adSoyad,
        pozisyon: c.pozisyon,
        telefon: c.telefon,
        iseBaslama: c.iseBaslama,
        istenAyrilma: c.istenAyrilma,
        engelli: c.engelli,
        aktif: c.aktif,
        // Doğum tarihi özel bilgidir; listeye yalnızca "bugün doğum günü mü" bilgisi çıkar
        bugunDogumGunu:
          c.dogumTarihi !== null &&
          c.dogumTarihi.getUTCMonth() === simdi.getUTCMonth() &&
          c.dogumTarihi.getUTCDate() === simdi.getUTCDate(),
        // İşe giriş yıldönümü bugünse (ve aktifse) kutlama rozeti gösterilir
        bugunYilDonumu:
          c.aktif &&
          c.iseBaslama !== null &&
          c.iseBaslama.getUTCMonth() === simdi.getUTCMonth() &&
          c.iseBaslama.getUTCDate() === simdi.getUTCDate() &&
          c.iseBaslama.getUTCFullYear() < simdi.getUTCFullYear(),
        izinHakki,
        guncelYilHakki,
        kullanilanIzin,
        kalanIzin: izinHakki === null ? null : izinHakki - kullanilanIzin,
        // Bağlı panel hesabı durumu: null = yok, "bekliyor" = onay bekliyor, "var" = atanmış
        kullaniciDurumu: c.kullanici
          ? c.kullanici.onayDurumu === "bekliyor"
            ? "bekliyor"
            : "var"
          : null,
        kullaniciAdi: c.kullanici?.email ?? null,
      };
    })
  );
}

// POST /api/calisanlar — yeni çalışan ekler
export async function POST(istek: Request) {
  const y = await yetki("calisanlar", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const sonuc = await govdeDogrula(istek, calisanSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const calisan = await prisma.calisan.create({
    data: { ...sonuc.veri, firmaId: firmaId },
  });
  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "calisanlar",
    islem: "ekleme",
    hedefTip: "Çalışan",
    hedefId: calisan.id,
    hedefAd: calisan.adSoyad,
    detay: degisiklikOzeti(null, sonuc.veri),
  });
  return ok(calisan, 201);
}
