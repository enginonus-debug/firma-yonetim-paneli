import type { Prisma } from "@prisma/client";

// Teklif hesaplama ve ortak include tanımları

export type TeklifKalem = {
  aciklama: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
};

// Karar anında Teklif.anlikVeri alanına dondurulan kopya. Karara bağlanmış
// teklifin belgesi bu kopyadan üretilir; firma/müşteri kayıtları sonradan
// değişse bile onaylı teklif çıktısı değişmez.
export type TeklifAnlikVeri = {
  firma: {
    ad: string;
    adres: string | null;
    telefon: string | null;
    vergiNo: string | null;
    logo: string | null;
  };
  musteri: {
    ad: string;
    adres: string | null;
    telefon: string | null;
    vergiNo: string | null;
  };
  olusturanAd: string | null;
  onaylayanAd: string | null;
};

// Kalemlerden ara toplam, iskonto ve KDV dahil genel toplamı hesaplar.
// Sıra: ara toplam → iskonto düşülür → kalan (matrah) üzerinden KDV eklenir.
export function teklifTutarlari(
  kalemler: TeklifKalem[],
  kdvOrani: number,
  iskontoOrani = 0
) {
  const araToplam = kalemler.reduce(
    (t, k) => t + k.miktar * k.birimFiyat,
    0
  );
  const iskontoTutari = (araToplam * iskontoOrani) / 100;
  const matrah = araToplam - iskontoTutari;
  const kdvTutari = (matrah * kdvOrani) / 100;
  return {
    araToplam: Math.round(araToplam * 100) / 100,
    iskontoTutari: Math.round(iskontoTutari * 100) / 100,
    toplam: Math.round((matrah + kdvTutari) * 100) / 100,
  };
}

// Teklif geçmişi olayı (Teklif.gecmis dizisinin elemanı): teklifin hangi
// tutarla verildiği, nasıl revize edildiği ve kararlar buradan izlenir.
export type TeklifOlay = {
  tip: "olusturma" | "revize" | "onay" | "ret";
  zaman: string; // ISO
  kullaniciAd: string;
  toplam: number; // olay sonrası geçerli KDV dahil genel toplam
  iskontoOrani: number; // olay anındaki iskonto (%)
  aciklama?: string | null; // karar notu / revize açıklaması
};

// Mevcut geçmişe yeni olay ekler (gecmis alanı null olabilir)
export function gecmiseEkle(gecmis: unknown, olay: TeklifOlay): TeklifOlay[] {
  const dizi = Array.isArray(gecmis) ? (gecmis as TeklifOlay[]) : [];
  return [...dizi, olay];
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
