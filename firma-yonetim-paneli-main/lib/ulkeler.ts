// Müşteri telefonu için ülke arama kodları ve o ülkenin ulusal numara hane
// aralığı (min-max). Yerel (Türkiye) müşteride "+90" ve tam 10 hane beklenir.
// Doğrulama hem istemcide hem sunucuda bu tablodan yapılır.
export type Ulke = { kod: string; ad: string; min: number; max: number };

export const ULKELER: Ulke[] = [
  { kod: "+90", ad: "Türkiye", min: 10, max: 10 },
  { kod: "+49", ad: "Almanya", min: 10, max: 11 },
  { kod: "+1", ad: "ABD / Kanada", min: 10, max: 10 },
  { kod: "+44", ad: "Birleşik Krallık", min: 10, max: 10 },
  { kod: "+33", ad: "Fransa", min: 9, max: 9 },
  { kod: "+31", ad: "Hollanda", min: 9, max: 9 },
  { kod: "+32", ad: "Belçika", min: 8, max: 9 },
  { kod: "+39", ad: "İtalya", min: 9, max: 10 },
  { kod: "+34", ad: "İspanya", min: 9, max: 9 },
  { kod: "+41", ad: "İsviçre", min: 9, max: 9 },
  { kod: "+43", ad: "Avusturya", min: 10, max: 11 },
  { kod: "+7", ad: "Rusya", min: 10, max: 10 },
  { kod: "+380", ad: "Ukrayna", min: 9, max: 9 },
  { kod: "+994", ad: "Azerbaycan", min: 9, max: 9 },
  { kod: "+971", ad: "BAE", min: 9, max: 9 },
  { kod: "+966", ad: "Suudi Arabistan", min: 9, max: 9 },
  { kod: "+974", ad: "Katar", min: 8, max: 8 },
  { kod: "+20", ad: "Mısır", min: 10, max: 10 },
  { kod: "+98", ad: "İran", min: 10, max: 10 },
  { kod: "+964", ad: "Irak", min: 10, max: 10 },
  { kod: "+86", ad: "Çin", min: 11, max: 11 },
  { kod: "+91", ad: "Hindistan", min: 10, max: 10 },
  { kod: "+81", ad: "Japonya", min: 10, max: 10 },
  { kod: "+82", ad: "Güney Kore", min: 9, max: 10 },
  { kod: "+30", ad: "Yunanistan", min: 10, max: 10 },
  { kod: "+359", ad: "Bulgaristan", min: 8, max: 9 },
  { kod: "+40", ad: "Romanya", min: 9, max: 9 },
];

const ULKE_HARITA = new Map(ULKELER.map((u) => [u.kod, u]));

export function ulkeBul(kod: string): Ulke | undefined {
  return ULKE_HARITA.get(kod);
}

// Verilen ülke kodu + rakam dizisi geçerli mi? Boş numara "geçerli" sayılır
// (telefon isteğe bağlıdır); dolu ise o ülkenin hane aralığına uymalıdır.
export function telefonGecerli(kod: string, rakamlar: string): boolean {
  if (!rakamlar) return true;
  const u = ulkeBul(kod);
  if (!u) return false;
  return rakamlar.length >= u.min && rakamlar.length <= u.max;
}
