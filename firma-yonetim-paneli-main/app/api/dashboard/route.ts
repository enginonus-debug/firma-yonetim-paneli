import { prisma } from "@/lib/db";
import { bugun, hata, ok } from "@/lib/api";
import { aktifKullanici, izinSeviyesi } from "@/lib/yetki";
import { gorevGorunurWhere } from "@/lib/gorev-atama";

// GET /api/dashboard — panel özet verileri.
// Yalnızca kullanıcının en az okuma izni olan modüllerin bölümleri döner;
// izinsiz modülün verisi (ör. tahsilat tutarları) yanıtta hiç yer almaz.
export async function GET() {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);
  if (kullanici.rol === "superadmin") {
    return hata("Bu uç firma kullanıcıları içindir; yönetim ekranını kullanın", 403);
  }
  const firmaId = kullanici.firmaId;
  const izinli = (modul: Parameters<typeof izinSeviyesi>[1]) =>
    izinSeviyesi(kullanici, modul) !== "yok";

  const bugunTarihi = bugun();

  // Vadesi geçenleri işaretle ki özet doğru olsun (tahsilat izni olmasa da
  // firma verisinin tutarlılığı için çalışır; kullanıcıya veri sızdırmaz)
  await prisma.tahsilat.updateMany({
    where: { firmaId, durum: "bekliyor", vadeTarihi: { lt: bugunTarihi } },
    data: { durum: "gecikti" },
  });

  const yanit: Record<string, unknown> = {};

  if (izinli("gorevler")) {
    // Yalnızca kullanıcının dahil olduğu (görebildiği) görevler sayılır/gösterilir
    const gorunur = gorevGorunurWhere(firmaId, kullanici.id);
    const [gorevGruplari, acikGorevler] = await Promise.all([
      prisma.gorev.groupBy({
        by: ["durum"],
        where: gorunur,
        _count: { _all: true },
      }),
      prisma.gorev.findMany({
        where: { ...gorunur, durum: { not: "tamamlandi" } },
        include: {
          atamalar: {
            where: { rol: "atanan" },
            select: { kullanici: { select: { adSoyad: true } } },
          },
        },
        orderBy: { olusturma: "desc" },
        take: 5,
      }),
    ]);
    const gorevSay = (durum: string) =>
      gorevGruplari.find((g) => g.durum === durum)?._count._all ?? 0;
    yanit.gorevler = {
      bekliyor: gorevSay("bekliyor"),
      devamEdiyor: gorevSay("devam_ediyor"),
      tamamlandi: gorevSay("tamamlandi"),
    };
    yanit.acikGorevler = acikGorevler;
  }

  if (izinli("devam")) {
    const [aktifCalisanSayisi, bugunkuDevam] = await Promise.all([
      prisma.calisan.count({ where: { firmaId, aktif: true } }),
      prisma.devam.findMany({
        where: { firmaId, tarih: bugunTarihi },
        select: { durum: true },
      }),
    ]);
    const devamSay = (durum: string) =>
      bugunkuDevam.filter((d) => d.durum === durum).length;
    yanit.devam = {
      aktifCalisan: aktifCalisanSayisi,
      geldi: devamSay("geldi"),
      gelmedi: devamSay("gelmedi"),
      izinli: devamSay("izinli"),
      kayitsiz: Math.max(0, aktifCalisanSayisi - bugunkuDevam.length),
    };
  }

  if (izinli("makineler")) {
    // Bakımda/arızalı makineler + açık olayın başlangıcı (kaç gündür sorunlu)
    yanit.sorunluMakineler = await prisma.makine.findMany({
      where: { firmaId, durum: { not: "calisiyor" } },
      select: {
        id: true,
        ad: true,
        durum: true,
        durumNotu: true,
        sorumlu: { select: { adSoyad: true } },
        olaylar: {
          where: { bitis: null },
          orderBy: { baslangic: "desc" },
          take: 1,
          select: { baslangic: true },
        },
      },
      orderBy: { ad: "asc" },
      take: 5,
    });
  }

  if (izinli("tahsilatlar")) {
    // Önümüzdeki 7 gün içinde vadesi dolacak bekleyen tahsilatlar
    const yediGunSonra = new Date(bugunTarihi);
    yediGunSonra.setUTCDate(yediGunSonra.getUTCDate() + 7);
    yanit.yaklasanTahsilatlar = await prisma.tahsilat.findMany({
      where: {
        firmaId,
        durum: "bekliyor",
        vadeTarihi: { gte: bugunTarihi, lte: yediGunSonra },
      },
      include: { musteri: { select: { id: true, ad: true } } },
      orderBy: { vadeTarihi: "asc" },
      take: 5,
    });

    const [bekleyen, geciken, gecikenTahsilatlar] = await Promise.all([
      prisma.tahsilat.aggregate({
        where: { firmaId, durum: "bekliyor" },
        _sum: { tutar: true },
        _count: { _all: true },
      }),
      prisma.tahsilat.aggregate({
        where: { firmaId, durum: "gecikti" },
        _sum: { tutar: true },
        _count: { _all: true },
      }),
      prisma.tahsilat.findMany({
        where: { firmaId, durum: "gecikti" },
        include: { musteri: { select: { id: true, ad: true } } },
        orderBy: { vadeTarihi: "asc" },
        take: 5,
      }),
    ]);
    yanit.tahsilat = {
      bekleyenTutar: Number(bekleyen._sum.tutar ?? 0),
      bekleyenAdet: bekleyen._count._all,
      gecikenTutar: Number(geciken._sum.tutar ?? 0),
      gecikenAdet: geciken._count._all,
    };
    yanit.gecikenTahsilatlar = gecikenTahsilatlar;
  }

  if (izinli("musteriler")) {
    yanit.acikFirsatSayisi = await prisma.satisFirsati.count({
      where: { firmaId, durum: { in: ["potansiyel", "gorusuluyor"] } },
    });
  }

  if (izinli("calisanlar")) {
    // Bugün doğum günü ve işe giriş yıl dönümü olan aktif çalışanlar
    // (yıl bağımsız, gün+ay eşleşmesi). Foto yalnızca eşleşenler için çekilir.
    const adaylar = await prisma.calisan.findMany({
      where: { firmaId, aktif: true },
      select: { id: true, adSoyad: true, telefon: true, dogumTarihi: true, iseBaslama: true },
    });
    const gun = bugunTarihi.getUTCDate();
    const ay = bugunTarihi.getUTCMonth();
    const yil = bugunTarihi.getUTCFullYear();

    const dogumlu = adaylar.filter(
      (c) =>
        c.dogumTarihi !== null &&
        c.dogumTarihi.getUTCMonth() === ay &&
        c.dogumTarihi.getUTCDate() === gun
    );
    const yilDonumu = adaylar.filter(
      (c) =>
        c.iseBaslama !== null &&
        c.iseBaslama.getUTCMonth() === ay &&
        c.iseBaslama.getUTCDate() === gun &&
        c.iseBaslama.getUTCFullYear() < yil
    );

    // İki listedeki tüm çalışanların fotoğrafını tek sorguda çek
    const idler = [...new Set([...dogumlu, ...yilDonumu].map((c) => c.id))];
    const fotoHarita = new Map<number, string | null>();
    if (idler.length > 0) {
      const fotolar = await prisma.calisan.findMany({
        where: { id: { in: idler } },
        select: { id: true, foto: true },
      });
      for (const f of fotolar) fotoHarita.set(f.id, f.foto);
    }

    yanit.bugunDoganlar = dogumlu.map((c) => ({
      id: c.id,
      adSoyad: c.adSoyad,
      telefon: c.telefon,
      dogumTarihi: c.dogumTarihi,
      foto: fotoHarita.get(c.id) ?? null,
    }));
    yanit.bugunYilDonumu = yilDonumu.map((c) => ({
      id: c.id,
      adSoyad: c.adSoyad,
      telefon: c.telefon,
      iseBaslama: c.iseBaslama,
      yil: yil - c.iseBaslama!.getUTCFullYear(),
      foto: fotoHarita.get(c.id) ?? null,
    }));
  }

  // Yöneticiye (admin) onay bekleyen teklif sayısı — panelde uyarı kartı için
  if (kullanici.rol === "admin") {
    yanit.onayBekleyenTeklif = await prisma.teklif.count({
      where: { firmaId, durum: "onay_bekliyor" },
    });
  }

  return ok(yanit);
}
