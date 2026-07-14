import type { Prisma } from "@prisma/client";

// Teklif hesaplama ve ortak include tanımları

export type TeklifKalem = {
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
};

// Kalemlerden ara toplam ve KDV dahil genel toplamı hesaplar
export function teklifTutarlari(kalemler: TeklifKalem[], kdvOrani: number) {
  const araToplam = kalemler.reduce(
    (t, k) => t + k.miktar * k.birimFiyat,
    0
  );
  const kdvTutari = (araToplam * kdvOrani) / 100;
  return {
    araToplam: Math.round(araToplam * 100) / 100,
    toplam: Math.round((araToplam + kdvTutari) * 100) / 100,
  };
}

export const teklifIliskileri = {
  satisFirsati: {
    select: {
      id: true,
      baslik: true,
      durum: true,
      musteri: { select: { id: true, ad: true } },
    },
  },
  olusturan: { select: { id: true, adSoyad: true } },
  onaylayan: { select: { id: true, adSoyad: true } },
  ekler: {
    select: { id: true, dosyaAd: true, mimeTip: true, boyut: true, olusturma: true },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.TeklifInclude;
