// Yıllık ücretli izin hakkı — 4857 sayılı İş Kanunu md. 53
//
// Hizmet süresine göre:
//   1 yıldan 5 yıla kadar (5 yıl dâhil)  → 14 gün
//   5 yıldan fazla, 15 yıldan az         → 20 gün
//   15 yıl (dâhil) ve üzeri              → 26 gün
// 50 yaş ve üzeri ile 18 yaşından küçük çalışanlarda alt sınır 20 gündür.
// 1 yılını doldurmamış çalışanın henüz izin hakkı doğmaz (0 gün).

// İki tarih arasındaki tam yıl sayısı (yıldönümü henüz gelmediyse bir eksik)
export function tamYil(baslangic: Date, referans: Date): number {
  let yil = referans.getUTCFullYear() - baslangic.getUTCFullYear();
  const yildonumuGecti =
    referans.getUTCMonth() > baslangic.getUTCMonth() ||
    (referans.getUTCMonth() === baslangic.getUTCMonth() &&
      referans.getUTCDate() >= baslangic.getUTCDate());
  if (!yildonumuGecti) yil -= 1;
  return yil;
}

// İçinde bulunulan izin yılının başlangıcı: işe girişin son yıldönümü.
// Kullanılan izin bu tarihten itibaren sayılır; her yıldönümünde hak yenilenir.
export function izinYiliBaslangici(iseBaslama: Date, referans: Date): Date {
  const yil = referans.getUTCFullYear();
  const buYilki = new Date(
    Date.UTC(yil, iseBaslama.getUTCMonth(), iseBaslama.getUTCDate())
  );
  if (buYilki <= referans) return buYilki;
  return new Date(Date.UTC(yil - 1, iseBaslama.getUTCMonth(), iseBaslama.getUTCDate()));
}

// Belirli bir kıdem yılı için o yılın izin günü (kıdem ve yaşa göre).
//   1–5 yıl → 14 · 5–15 yıl arası → 20 · 15 yıl ve üzeri → 26
//   50 yaş ve üzeri / 18 yaş altı çalışanda alt sınır 20 gündür.
function yilIzinGunu(hizmetYili: number, yas: number | null): number {
  let hak: number;
  if (hizmetYili <= 5) hak = 14;
  else if (hizmetYili < 15) hak = 20;
  else hak = 26;
  if (yas !== null && (yas >= 50 || yas < 18)) hak = Math.max(hak, 20);
  return hak;
}

// İçinde bulunulan izin yılının hak sayısı (kıdem + yaşa göre tek yıl).
// İşe başlama tarihi yoksa hesaplanamaz (null); 1 yılını doldurmadıysa 0.
export function yillikIzinHakki(
  iseBaslama: Date | null,
  dogumTarihi: Date | null,
  referans: Date
): number | null {
  if (!iseBaslama) return null;
  const hizmetYili = tamYil(iseBaslama, referans);
  if (hizmetYili < 1) return 0;
  const yas = dogumTarihi ? tamYil(dogumTarihi, referans) : null;
  return yilIzinGunu(hizmetYili, yas);
}

// Çalışılan TÜM yıllar boyunca hak edilen TOPLAM (birikimli) yıllık izin.
// Her tamamlanan hizmet yılı için, o yıldönümündeki kıdem ve yaşa göre hak
// eklenir. Böylece uzun süredir çalışan birinin toplam hakkı doğru hesaplanır.
// Örn. 3 yıllık çalışan: 14+14+14 = 42 gün.
export function toplamIzinHakki(
  iseBaslama: Date | null,
  dogumTarihi: Date | null,
  referans: Date
): number | null {
  if (!iseBaslama) return null;
  const tamamlanan = tamYil(iseBaslama, referans);
  if (tamamlanan < 1) return 0;

  let toplam = 0;
  for (let i = 1; i <= tamamlanan; i++) {
    // i. hizmet yılının bittiği yıldönümü — hak o tarihteki kıdem/yaşa göre
    const yildonumu = new Date(
      Date.UTC(
        iseBaslama.getUTCFullYear() + i,
        iseBaslama.getUTCMonth(),
        iseBaslama.getUTCDate()
      )
    );
    const yas = dogumTarihi ? tamYil(dogumTarihi, yildonumu) : null;
    toplam += yilIzinGunu(i, yas);
  }
  return toplam;
}
