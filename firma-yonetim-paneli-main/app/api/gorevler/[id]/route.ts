import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok, prismaHataKodu } from "@/lib/api";
import { gorevGuncelleSemasi, gorevIslemSemasi } from "@/lib/semalar";
import { degisiklikOzeti, denetimKaydet } from "@/lib/denetim";
import {
  atamalariDogrula,
  atamalariGuncelle,
  gorevGorunurWhere,
  gorevIliskileri,
  gorevYetkili,
} from "@/lib/gorev-atama";
import { bildirimGonder, type BildirimTip } from "@/lib/bildirim";

type Baglam = { params: Promise<{ id: string }> };

// GET /api/gorevler/:id — görev detayı (yalnızca görevde yer alan kullanıcı görür)
export async function GET(_istek: Request, { params }: Baglam) {
  const y = await yetki("gorevler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const gorev = await prisma.gorev.findFirst({
    where: { id, ...gorevGorunurWhere(firmaId, y.kullanici.id) },
    include: gorevIliskileri,
  });
  if (!gorev) return hata("Görev bulunamadı", 404);
  return ok(gorev);
}

// PUT /api/gorevler/:id — görevi günceller. Kısıtlı alanları (atananlar, denetçi,
// kontrolör, makine, öncelik, başlangıç vb.) yalnızca görevi ATAYAN veya admin
// düzenleyebilir; böylece iş akışında karışıklık olmaz.
export async function PUT(istek: Request, { params }: Baglam) {
  const y = await yetki("gorevler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const eski = await prisma.gorev.findFirst({ where: { id, firmaId: firmaId } });
  if (!eski) return hata("Görev bulunamadı", 404);

  // Kısıtlı alanları YALNIZCA görevi oluşturan (atayan) düzenleyebilir — admin
  // dahil başkası düzenleyemez ki iş akışında karışıklık olmasın.
  // İstisna: oluşturanı kayıtlı olmayan ESKİ görevler (bu özellik eklenmeden önce
  // açılmış, olusturanId=null) — onları adminler yönetebilir ki kilitli kalmasın.
  if (!gorevYetkili(eski, y.kullanici)) {
    return hata("Bu görevi yalnızca oluşturan kişi düzenleyebilir", 403);
  }

  const sonuc = await govdeDogrula(istek, gorevGuncelleSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { atananlar, denetciId, kontrolorId, izleyiciler, ...alanlar } = sonuc.veri;

  const atamaHatasi = await atamalariDogrula(firmaId, { atananlar, denetciId, kontrolorId, izleyiciler });
  if (atamaHatasi) return hata(atamaHatasi);

  // Oluşturanı kayıtlı olmayan eski görevi bir admin düzenliyorsa, onu bu kişiye
  // sahiplendir (olusturanId'yi ata) — böylece bundan sonra katı kural işler.
  const sahiplen = eski.olusturanId === null ? { olusturanId: y.kullanici.id } : {};

  try {
    const gorev = await prisma.$transaction(async (tx) => {
      await tx.gorev.update({ where: { id, firmaId: firmaId }, data: { ...alanlar, ...sahiplen } });
      await atamalariGuncelle(tx, id, { atananlar, denetciId, kontrolorId, izleyiciler });
      return tx.gorev.findFirstOrThrow({ where: { id }, include: gorevIliskileri });
    });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "gorevler",
      islem: "guncelleme",
      hedefTip: "Görev",
      hedefId: gorev.id,
      hedefAd: gorev.baslik,
      detay: degisiklikOzeti(eski, { ...alanlar, atananlar, denetciId, kontrolorId }),
    });
    return ok(gorev);
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Görev bulunamadı", 404);
    throw e;
  }
}

// PATCH /api/gorevler/:id — iş akışı işlemi: basla | tamamla | onayla | reddet.
// Zincir: atanan tamamlar → kontrolör onayı → denetçi onayı → atayana "tamamlandı"
// bildirimi. Kontrolör/denetçi yoksa o aşama atlanır. Her aşamayı yalnızca ilgili
// rol (veya admin) yapabilir; her geçişte ilgili kişilere bildirim gider.
export async function PATCH(istek: Request, { params }: Baglam) {
  const y = await yetki("gorevler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, gorevIslemSemasi);
  if (sonuc.yanit) return sonuc.yanit;
  const { islem, not } = sonuc.veri;

  const gorev = await prisma.gorev.findFirst({
    where: { id, firmaId },
    include: gorevIliskileri,
  });
  if (!gorev) return hata("Görev bulunamadı", 404);

  const uid = y.kullanici.id;
  const admin = y.kullanici.rol === "admin";
  const roller = new Set(
    gorev.atamalar.filter((a) => a.kullanici.id === uid).map((a) => a.rol)
  );
  const atananIdler = gorev.atamalar.filter((a) => a.rol === "atanan").map((a) => a.kullanici.id);
  const kontrolorIdler = gorev.atamalar.filter((a) => a.rol === "kontrolor").map((a) => a.kullanici.id);
  const denetciIdler = gorev.atamalar.filter((a) => a.rol === "denetci").map((a) => a.kullanici.id);
  const kontrolorVar = kontrolorIdler.length > 0;
  const denetciVar = denetciIdler.length > 0;
  const atayanId = gorev.olusturanId;
  const b = gorev.baslik;

  // Sonuç: yeni durum + gönderilecek bildirimler + red notu
  let yeniDurum: string | null = null;
  let redNotu: string | null | undefined = undefined;
  const bildirimler: { ids: number[]; tip: BildirimTip; mesaj: string }[] = [];
  const yetkiHata = () => hata("Bu işlem için yetkiniz yok (yalnızca ilgili rol yapabilir)", 403);

  if (islem === "basla") {
    if (!admin && !roller.has("atanan")) return yetkiHata();
    if (gorev.durum !== "bekliyor") return hata("Görev zaten başlatılmış");
    yeniDurum = "devam_ediyor";
  } else if (islem === "tamamla") {
    if (!admin && !roller.has("atanan")) return yetkiHata();
    if (gorev.durum !== "devam_ediyor") return hata("Görev tamamlanacak aşamada değil");
    redNotu = null; // yeniden tamamlanıyor, eski ret notunu temizle
    if (kontrolorVar) {
      yeniDurum = "kontrol_bekliyor";
      bildirimler.push({ ids: kontrolorIdler, tip: "kontrol_bekliyor", mesaj: `"${b}" göreviniz kontrol onayınızı bekliyor` });
    } else if (denetciVar) {
      yeniDurum = "denetim_bekliyor";
      bildirimler.push({ ids: denetciIdler, tip: "denetim_bekliyor", mesaj: `"${b}" göreviniz denetim onayınızı bekliyor` });
    } else {
      yeniDurum = "tamamlandi";
      if (atayanId) bildirimler.push({ ids: [atayanId], tip: "tamamlandi", mesaj: `"${b}" görevi tamamlandı` });
    }
  } else if (islem === "onayla") {
    if (gorev.durum === "kontrol_bekliyor") {
      if (!admin && !roller.has("kontrolor")) return yetkiHata();
      if (denetciVar) {
        yeniDurum = "denetim_bekliyor";
        bildirimler.push({ ids: denetciIdler, tip: "denetim_bekliyor", mesaj: `"${b}" göreviniz denetim onayınızı bekliyor` });
      } else {
        yeniDurum = "tamamlandi";
        if (atayanId) bildirimler.push({ ids: [atayanId], tip: "tamamlandi", mesaj: `"${b}" görevi tamamlandı` });
      }
    } else if (gorev.durum === "denetim_bekliyor") {
      if (!admin && !roller.has("denetci")) return yetkiHata();
      yeniDurum = "tamamlandi";
      if (atayanId) bildirimler.push({ ids: [atayanId], tip: "tamamlandi", mesaj: `"${b}" görevi tamamlandı` });
    } else {
      return hata("Görev onay aşamasında değil");
    }
  } else if (islem === "reddet") {
    if (gorev.durum === "kontrol_bekliyor") {
      if (!admin && !roller.has("kontrolor")) return yetkiHata();
    } else if (gorev.durum === "denetim_bekliyor") {
      if (!admin && !roller.has("denetci")) return yetkiHata();
    } else {
      return hata("Görev onay aşamasında değil");
    }
    yeniDurum = "devam_ediyor";
    redNotu = not?.trim() || null;
    bildirimler.push({
      ids: atananIdler,
      tip: "reddedildi",
      mesaj: `"${b}" göreviniz reddedildi${redNotu ? ": " + redNotu : ""} — düzeltme bekleniyor`,
    });
  }

  if (!yeniDurum) return hata("Geçersiz işlem");

  const guncel = await prisma.$transaction(async (tx) => {
    const g = await tx.gorev.update({
      where: { id, firmaId },
      data: { durum: yeniDurum!, ...(redNotu !== undefined ? { redNotu } : {}) },
      include: gorevIliskileri,
    });
    for (const bd of bildirimler) {
      await bildirimGonder(tx, {
        firmaId,
        kullaniciIdler: bd.ids,
        tip: bd.tip,
        mesaj: bd.mesaj,
        gorevId: id,
        haric: uid,
      });
    }
    return g;
  });

  await denetimKaydet({
    kullanici: y.kullanici,
    ekran: "gorevler",
    islem: "guncelleme",
    hedefTip: "Görev",
    hedefId: id,
    hedefAd: gorev.baslik,
    detay: degisiklikOzeti({ durum: gorev.durum }, { durum: yeniDurum, ...(redNotu !== undefined ? { redNotu } : {}) }),
  });
  return ok(guncel);
}

// DELETE /api/gorevler/:id — görevi siler (atamalar cascade ile temizlenir).
// Yalnızca atayan veya admin silebilir.
export async function DELETE(_istek: Request, { params }: Baglam) {
  const y = await yetki("gorevler", "yazma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const eski = await prisma.gorev.findFirst({ where: { id, firmaId: firmaId } });
  if (!eski) return hata("Görev bulunamadı", 404);
  if (!gorevYetkili(eski, y.kullanici)) {
    return hata("Bu görevi yalnızca oluşturan kişi silebilir", 403);
  }

  try {
    await prisma.gorev.delete({ where: { id, firmaId: firmaId } });
    await denetimKaydet({
      kullanici: y.kullanici,
      ekran: "gorevler",
      islem: "silme",
      hedefTip: "Görev",
      hedefId: id,
      hedefAd: eski.baslik,
    });
    return ok({ mesaj: "Görev silindi" });
  } catch (e) {
    if (prismaHataKodu(e) === "P2025") return hata("Görev bulunamadı", 404);
    throw e;
  }
}
