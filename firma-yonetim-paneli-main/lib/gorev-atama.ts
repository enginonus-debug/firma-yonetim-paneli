import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Görev atama yardımcıları: atananlar (çoklu) + denetçi + kontrolör.
// Kural: görev yalnızca giriş bilgisi olan panel kullanıcılarına atanabilir;
// hesap aynı firmada, aktif ve onaylanmış olmalı (superadmin hariç).

export type AtamaGirdisi = {
  atananlar?: number[];
  denetciId?: number | null;
  kontrolorId?: number | null;
  // Görevi yalnızca görüntüleyebilecek (izleyici) kullanıcılar — iş akışında
  // rolleri yoktur ama görevi görebilirler
  izleyiciler?: number[];
};

// Bir kullanıcının GÖREBİLECEĞİ görevlerin Prisma where koşulu: yalnızca
// oluşturan (atayan) veya bir atamada (atanan/denetçi/kontrolör/izleyici) yer
// aldığı görevleri görür. Başka kimse (admin dahil) o görevi göremez.
export function gorevGorunurWhere(firmaId: number, kullaniciId: number): Prisma.GorevWhereInput {
  return {
    firmaId,
    OR: [
      { olusturanId: kullaniciId },
      { atamalar: { some: { kullaniciId } } },
    ],
  };
}

// Kısıtlı işlemleri (düzenleme, ek silme, görev silme) yapabilir mi?
// Kural: yalnızca görevi oluşturan. İstisna: oluşturanı kayıtlı olmayan ESKİ
// görevleri (olusturanId=null) adminler yönetebilir ki kalıcı kilitlenmesin.
export function gorevYetkili(
  gorev: { olusturanId: number | null },
  kullanici: { id: number; rol: string }
): boolean {
  if (gorev.olusturanId === kullanici.id) return true;
  if (gorev.olusturanId === null && kullanici.rol === "admin") return true;
  return false;
}

export const gorevIliskileri = {
  makine: { select: { id: true, ad: true } },
  olusturan: { select: { id: true, adSoyad: true } },
  atamalar: {
    select: { rol: true, kullanici: { select: { id: true, adSoyad: true } } },
    orderBy: { id: "asc" as const },
  },
  ekler: {
    // İçerik (veri) hariç üst bilgi; indirme ayrı uçtan yapılır
    select: {
      id: true,
      tur: true,
      dosyaAd: true,
      mimeTip: true,
      boyut: true,
      yukleyenAd: true,
      olusturma: true,
    },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.GorevInclude;

// Girdideki tüm kullanıcı id'lerinin atanabilir olduğunu doğrular.
// Geçersiz id varsa hata mesajı döner.
export async function atamalariDogrula(
  firmaId: number,
  girdi: AtamaGirdisi
): Promise<string | null> {
  const idler = new Set<number>(girdi.atananlar ?? []);
  if (girdi.denetciId) idler.add(girdi.denetciId);
  if (girdi.kontrolorId) idler.add(girdi.kontrolorId);
  for (const i of girdi.izleyiciler ?? []) idler.add(i);
  if (idler.size === 0) return null;

  const bulunan = await prisma.kullanici.count({
    where: {
      id: { in: [...idler] },
      firmaId,
      aktif: true,
      onayDurumu: "onaylandi",
      rol: { in: ["admin", "kullanici"] },
    },
  });
  return bulunan === idler.size
    ? null
    : "Görev yalnızca giriş bilgisi olan aktif panel kullanıcılarına atanabilir";
}

// Yeni görev için atama kayıtlarını üretir
export function atamaKayitlari(girdi: AtamaGirdisi) {
  const kayitlar: { kullaniciId: number; rol: string }[] = [
    ...new Set(girdi.atananlar ?? []),
  ].map((kullaniciId) => ({ kullaniciId, rol: "atanan" }));
  if (girdi.denetciId) kayitlar.push({ kullaniciId: girdi.denetciId, rol: "denetci" });
  if (girdi.kontrolorId) kayitlar.push({ kullaniciId: girdi.kontrolorId, rol: "kontrolor" });
  for (const kullaniciId of new Set(girdi.izleyiciler ?? [])) {
    kayitlar.push({ kullaniciId, rol: "izleyici" });
  }
  return kayitlar;
}

// Güncellemede yalnızca gönderilen rol gruplarını değiştirir
// (undefined = dokunma, [] veya null = temizle)
export async function atamalariGuncelle(
  tx: Prisma.TransactionClient,
  gorevId: number,
  girdi: AtamaGirdisi
) {
  // Çoklu roller (atanan, izleyici): gönderilen listeyle değiştir
  const cokluRoller = [
    { rol: "atanan", liste: girdi.atananlar },
    { rol: "izleyici", liste: girdi.izleyiciler },
  ] as const;
  for (const { rol, liste } of cokluRoller) {
    if (liste === undefined) continue;
    await tx.gorevAtama.deleteMany({ where: { gorevId, rol } });
    const benzersiz = [...new Set(liste)];
    if (benzersiz.length > 0) {
      await tx.gorevAtama.createMany({
        data: benzersiz.map((kullaniciId) => ({ gorevId, kullaniciId, rol })),
      });
    }
  }
  const tekliRoller = [
    { rol: "denetci", id: girdi.denetciId },
    { rol: "kontrolor", id: girdi.kontrolorId },
  ] as const;
  for (const { rol, id } of tekliRoller) {
    if (id === undefined) continue;
    await tx.gorevAtama.deleteMany({ where: { gorevId, rol } });
    if (id) await tx.gorevAtama.create({ data: { gorevId, kullaniciId: id, rol } });
  }
}
