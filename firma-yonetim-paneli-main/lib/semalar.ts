import { z } from "zod";
import { telefonGecerli, ulkeBul } from "@/lib/ulkeler";

// ---- Ortak parçalar ----
const tarihStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-AA-GG biçiminde olmalı");
const saatStr = z.string().regex(/^\d{2}:\d{2}$/, "SS:DD biçiminde olmalı");
const idNo = z.number().int().positive();

// ---- Firma ----
export const firmaSemasi = z.object({
  ad: z.string().min(1, "Firma adı zorunlu"),
  adres: z.string().nullish(),
  telefon: z.string().nullish(),
  vergiNo: z.string().nullish(),
  logo: z
    .string()
    .startsWith("data:image/", "Geçersiz logo biçimi")
    .max(1_000_000, "Logo çok büyük")
    .nullish(),
});

// ---- Çalışan ----
// Başında 0 olmadan 10 haneli telefon (ör: 5321234567)
const telefon10 = /^[1-9]\d{9}$/;
// Kayıtlar tek biçim görünsün diye ad ve pozisyon Türkçe büyük harfe çevrilir
const buyukHarf = (s: string) => s.toLocaleUpperCase("tr-TR");

const calisanTaban = z.object({
  adSoyad: z.string().min(1, "Ad soyad zorunlu").transform(buyukHarf),
  tcKimlikNo: z
    .string({ error: "TC kimlik no zorunlu" })
    .regex(/^\d{11}$/, "TC kimlik no 11 haneli rakam olmalı"),
  dogumTarihi: z.coerce.date({ error: "Doğum tarihi zorunlu" }),
  cinsiyet: z.enum(["erkek", "kadin"], { error: "Cinsiyet seçimi zorunlu" }),
  pozisyon: z
    .string({ error: "Pozisyon zorunlu" })
    .min(1, "Pozisyon zorunlu")
    .transform(buyukHarf),
  telefon: z
    .string({ error: "Telefon zorunlu" })
    .regex(telefon10, "Telefon başında 0 olmadan 10 haneli olmalı"),
  il: z.string({ error: "İl seçimi zorunlu" }).min(1, "İl seçimi zorunlu"),
  ilce: z.string({ error: "İlçe seçimi zorunlu" }).min(1, "İlçe seçimi zorunlu"),
  adres: z.string({ error: "İkamet bilgisi zorunlu" }).min(1, "İkamet bilgisi zorunlu"),
  acilTelefon: z
    .string({ error: "Acil durumda aranacak yakın numarası zorunlu" })
    .regex(telefon10, "Yakın numarası başında 0 olmadan 10 haneli olmalı"),
  foto: z
    .string()
    .startsWith("data:image/", "Geçersiz görsel biçimi")
    .max(700_000, "Fotoğraf çok büyük")
    .nullish(),
  iseBaslama: z.coerce.date({ error: "İşe başlama tarihi zorunlu" }),
  istenAyrilma: z.coerce.date().nullish(),
  maas: z.coerce.number().nonnegative("Maaş negatif olamaz").nullish(),
  engelli: z.boolean().optional(),
  engelDurumu: z.string().nullish(),
  aktif: z.boolean().optional(),
});

// Alanlar arası kurallar: engelli ise engel durumu, pasife alınıyorsa ayrılma tarihi zorunlu
function calisanKurallari(
  veri: Partial<z.infer<typeof calisanTaban>>,
  ctx: z.RefinementCtx
) {
  if (veri.engelli === true && !veri.engelDurumu?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["engelDurumu"],
      message: "Engelli çalışan için engel durum bilgisi zorunlu",
    });
  }
  if (veri.aktif === false && !veri.istenAyrilma) {
    ctx.addIssue({
      code: "custom",
      path: ["istenAyrilma"],
      message: "Pasife alınan çalışan için işten ayrılma tarihi zorunlu",
    });
  }
  // İşe başlama tarihi gelecekte olamaz
  if (veri.iseBaslama instanceof Date) {
    const bugunSonu = new Date();
    bugunSonu.setHours(23, 59, 59, 999);
    if (veri.iseBaslama > bugunSonu) {
      ctx.addIssue({
        code: "custom",
        path: ["iseBaslama"],
        message: "İşe başlama tarihi bugünden ileri bir tarih olamaz",
      });
    }
  }
}

export const calisanSemasi = calisanTaban.superRefine(calisanKurallari);
export const calisanGuncelleSemasi = calisanTaban.partial().superRefine(calisanKurallari);

// Toplu (Excel) içe aktarma için gevşek şema: yalnızca ad soyad zorunlu;
// listede olmayan bilgiler boş (null) bırakılabilir. Tür doğrulaması yapılır.
export const topluCalisanSemasi = z.object({
  adSoyad: z.string().min(1, "Ad soyad zorunlu").transform(buyukHarf),
  tcKimlikNo: z.string().nullish(),
  dogumTarihi: z.coerce.date().nullish(),
  cinsiyet: z.enum(["erkek", "kadin"]).nullish(),
  pozisyon: z.string().transform((s) => (s ? buyukHarf(s) : s)).nullish(),
  telefon: z.string().nullish(),
  il: z.string().nullish(),
  ilce: z.string().nullish(),
  adres: z.string().nullish(),
  acilTelefon: z.string().nullish(),
  iseBaslama: z.coerce.date().nullish(),
  maas: z.coerce.number().nonnegative().nullish(),
  engelli: z.boolean().optional(),
  engelDurumu: z.string().nullish(),
});
export const topluCalisanlarSemasi = z.object({
  calisanlar: z
    .array(topluCalisanSemasi)
    .min(1, "En az bir çalışan gerekli")
    .max(1000, "Tek seferde en fazla 1000 çalışan eklenebilir"),
});
// Pasife alma (DELETE) gövdesi
export const calisanPasifSemasi = z.object({ istenAyrilma: z.coerce.date() });
// Özel bilgi görüntüleme (detay) gövdesi
export const calisanDetaySemasi = z.object({ parola: z.string() });

// ---- Makine ----
export const makineDurumlari = ["calisiyor", "bakimda", "arizali"] as const;
const makineTaban = z.object({
  ad: z.string().min(1, "Makine adı zorunlu"),
  model: z.string().nullish(),
  seriNo: z.string().nullish(),
  durum: z.enum(makineDurumlari).default("calisiyor"),
  sorumluId: idNo.nullish(),
  durumNotu: z.string().nullish(), // bakımda/arızalıysa zorunlu açıklama
});

// Bakım/arıza durumuna açıklamasız geçilemez
function makineKurallari(
  veri: Partial<z.infer<typeof makineTaban>>,
  ctx: z.RefinementCtx
) {
  if (
    (veri.durum === "bakimda" || veri.durum === "arizali") &&
    !veri.durumNotu?.trim()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["durumNotu"],
      message:
        veri.durum === "arizali"
          ? "Arıza durumu için açıklama (arıza notu) zorunlu"
          : "Bakım durumu için açıklama (bakım notu) zorunlu",
    });
  }
}

export const makineSemasi = makineTaban.superRefine(makineKurallari);
export const makineGuncelleSemasi = makineTaban.partial().superRefine(makineKurallari);

// Toplu (Excel) içe aktarma için gevşek makine şeması: yalnızca ad zorunlu;
// diğer bilgiler boş bırakılabilir. Bakım/arıza notu zorunluluğu uygulanmaz.
// sorumlu bir isim olarak gelir; sunucu aktif çalışanlara göre eşler.
export const topluMakineSemasi = z.object({
  ad: z.string().min(1, "Makine adı zorunlu"),
  model: z.string().nullish(),
  seriNo: z.string().nullish(),
  durum: z.enum(makineDurumlari).default("calisiyor"),
  durumNotu: z.string().nullish(),
  sorumlu: z.string().nullish(), // isim; sunucu çalışan adıyla eşler
});
export const topluMakinelerSemasi = z.object({
  makineler: z
    .array(topluMakineSemasi)
    .min(1, "En az bir makine gerekli")
    .max(1000, "Tek seferde en fazla 1000 makine eklenebilir"),
});

// ---- Devam / puantaj ----
export const devamDurumlari = ["geldi", "gelmedi", "izinli"] as const;
export const devamSemasi = z.object({
  calisanId: idNo,
  tarih: tarihStr,
  durum: z.enum(devamDurumlari),
  girisSaat: saatStr.nullish(),
  cikisSaat: saatStr.nullish(),
});

// ---- Görev ----
export const gorevDurumlari = [
  "bekliyor",
  "devam_ediyor",
  "kontrol_bekliyor",
  "denetim_bekliyor",
  "tamamlandi",
] as const;
export const gorevOncelikleri = ["dusuk", "normal", "yuksek"] as const;
// İş akışı işlemleri: basla/tamamla (atanan) · onayla/reddet (kontrolör/denetçi)
export const gorevIslemleri = ["basla", "tamamla", "onayla", "reddet"] as const;
export const gorevIslemSemasi = z.object({
  islem: z.enum(gorevIslemleri),
  not: z.string().nullish(), // reddetme açıklaması
});
export const gorevAtamaRolleri = ["atanan", "denetci", "kontrolor", "izleyici"] as const;
export const gorevSemasi = z.object({
  baslik: z.string().min(1, "Görev başlığı zorunlu"),
  aciklama: z.string().nullish(),
  makineId: idNo.nullish(),
  durum: z.enum(gorevDurumlari).default("bekliyor"),
  oncelik: z.enum(gorevOncelikleri).nullish(),
  baslangic: z.coerce.date().nullish(),
  bitis: z.coerce.date().nullish(),
  // Görev yalnızca panel kullanıcılarına atanır; birden fazla kişi seçilebilir
  atananlar: z.array(idNo).max(20, "En fazla 20 kişi atanabilir").default([]),
  denetciId: idNo.nullish(),
  kontrolorId: idNo.nullish(),
  // Görevi yalnızca görüntüleyebilecek kullanıcılar (izleyici)
  izleyiciler: z.array(idNo).max(50, "En fazla 50 izleyici eklenebilir").default([]),
});
export const gorevGuncelleSemasi = gorevSemasi.partial();
export const gorevDurumSemasi = z.object({ durum: z.enum(gorevDurumlari) });

// ---- Takvim notu ----
export const takvimNotuSemasi = z.object({
  tarih: tarihStr,
  metin: z.string().min(1, "Not metni zorunlu").max(500, "Not en fazla 500 karakter olabilir"),
});
export const takvimNotuGuncelleSemasi = z.object({
  metin: z.string().min(1, "Not metni zorunlu").max(500, "Not en fazla 500 karakter olabilir"),
});

// ---- Müşteri ----
const eposta = z
  .string()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Geçerli bir e-posta girin");
// Vergi no verilmişse tam 10 haneli rakam olmalı (Türk vergi kimlik no)
const vergiNoAlani = z
  .string()
  .regex(/^\d{10}$/, "Vergi numarası 10 haneli rakam olmalı");
const musteriTaban = z.object({
  ad: z.string().min(1, "Müşteri adı zorunlu"),
  ulkeKodu: z.string().default("+90"),
  telefon: z.string().nullish(), // yalnızca rakamlar; uzunluk ülkeye göre denetlenir
  email: eposta.nullish(),
  adres: z.string().nullish(),
  vergiNo: vergiNoAlani.nullish(),
  yetkiliAd: z.string().nullish(),
  yetkiliUnvan: z.string().nullish(),
  yetkiliTelefon: z.string().nullish(),
  yetkiliEmail: eposta.nullish(),
  notlar: z.string().nullish(),
});

// Telefon (varsa) seçili ülkenin hane aralığına uymalı
function musteriKurallari(
  veri: { ulkeKodu?: string; telefon?: string | null; yetkiliTelefon?: string | null },
  ctx: z.RefinementCtx
) {
  const kod = veri.ulkeKodu ?? "+90";
  for (const alan of ["telefon", "yetkiliTelefon"] as const) {
    const deger = veri[alan];
    if (deger && !telefonGecerli(kod, deger.replace(/\D/g, ""))) {
      const u = ulkeBul(kod);
      const aralik = u ? (u.min === u.max ? `${u.min}` : `${u.min}-${u.max}`) : "geçerli";
      ctx.addIssue({
        code: "custom",
        path: [alan],
        message: `Telefon ${u?.ad ?? "seçili ülke"} için ${aralik} haneli olmalı`,
      });
    }
  }
}

export const musteriSemasi = musteriTaban.superRefine(musteriKurallari);
export const musteriGuncelleSemasi = musteriTaban.partial().superRefine(musteriKurallari);

// ---- Satış fırsatı ----
export const firsatDurumlari = [
  "potansiyel",
  "gorusuluyor",
  "kazanildi",
  "kaybedildi",
] as const;
const firsatTaban = z.object({
  musteriId: idNo,
  sorumluId: idNo.nullish(),
  baslik: z.string().nullish(),
  durum: z.enum(firsatDurumlari).default("potansiyel"),
  tutar: z.coerce.number().nonnegative().nullish(),
  tarih: z.coerce.date().nullish(),
  kayipNedeni: z.string().nullish(),
});

// Olumsuz sonuçlanan fırsat nedensiz kapatılamaz (ilgili satışçı yazar)
function firsatKurallari(
  veri: { durum?: string; kayipNedeni?: string | null },
  ctx: z.RefinementCtx
) {
  if (veri.durum === "kaybedildi" && !veri.kayipNedeni?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["kayipNedeni"],
      message: "Kaybedilen fırsat için olumsuz sonuç nedeni zorunlu",
    });
  }
}

export const firsatSemasi = firsatTaban.superRefine(firsatKurallari);
export const firsatGuncelleSemasi = firsatTaban.partial().superRefine(firsatKurallari);
export const firsatDurumSemasi = z
  .object({ durum: z.enum(firsatDurumlari), kayipNedeni: z.string().nullish() })
  .superRefine(firsatKurallari);

// ---- Fiyat teklifi (yönetici onaylı) ----
export const teklifDurumlari = ["onay_bekliyor", "onaylandi", "reddedildi"] as const;
export const teklifKalemSemasi = z.object({
  aciklama: z.string().min(1, "Kalem açıklaması zorunlu"),
  miktar: z.coerce.number().positive("Miktar sıfırdan büyük olmalı"),
  birim: z.string().min(1).default("adet"),
  birimFiyat: z.coerce.number().nonnegative("Birim fiyat negatif olamaz"),
});
export const teklifSemasi = z.object({
  satisFirsatiId: idNo,
  baslik: z.string().min(1, "Teklif başlığı zorunlu"),
  kalemler: z.array(teklifKalemSemasi).min(1, "En az bir teklif kalemi girin"),
  kdvOrani: z.coerce.number().min(0).max(100).default(20),
  gecerlilikTarihi: z.coerce.date().nullish(),
  notlar: z.string().nullish(),
  onaylayanId: idNo, // onayına gönderilecek yönetici (firma admini)
});
// Yönetici kararı: ret için açıklama zorunlu
export const teklifKararSemasi = z
  .object({
    karar: z.enum(["onayla", "reddet"]),
    kararNotu: z.string().nullish(),
  })
  .superRefine((veri, ctx) => {
    if (veri.karar === "reddet" && !veri.kararNotu?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["kararNotu"],
        message: "Ret kararı için açıklama zorunlu",
      });
    }
  });

// Teklif eki dosya kuralları (reçete görüntüsü veya maliyet belgesi)
export const TEKLIF_EK_MAKS_BOYUT = 8 * 1024 * 1024; // 8 MB
export const TEKLIF_EK_MAKS_ADET = 5;
export const TEKLIF_EK_TIPLERI: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// ---- Tahsilat ----
export const tahsilatDurumlari = ["bekliyor", "tahsil_edildi", "gecikti"] as const;
export const tahsilatSemasi = z.object({
  musteriId: idNo,
  satisFirsatiId: idNo.nullish(),
  tutar: z.coerce.number().positive("Tutar sıfırdan büyük olmalı"),
  vadeTarihi: z.coerce.date().nullish(),
  odemeTarihi: z.coerce.date().nullish(),
  durum: z.enum(tahsilatDurumlari).default("bekliyor"),
  odemeYontemi: z.string().nullish(),
});
export const tahsilatGuncelleSemasi = tahsilatSemasi.partial();
export const tahsilatDurumGuncelleSemasi = z.object({
  durum: z.enum(tahsilatDurumlari),
  odemeTarihi: z.coerce.date().nullish(),
  odemeYontemi: z.string().nullish(),
});

// ---- Kullanıcı yönetimi ----
const kullaniciAdi = z
  .string()
  .min(3, "Kullanıcı adı en az 3 karakter olmalı")
  .max(30, "Kullanıcı adı en fazla 30 karakter olmalı")
  .regex(/^[a-z0-9._-]+$/, "Kullanıcı adı küçük harf, rakam, nokta, tire veya alt çizgi içerebilir");
const sifreAlani = z.string().min(6, "Şifre en az 6 karakter olmalı").max(72);
export const izinSeviyeleri = ["yok", "okuma", "yazma"] as const;
// Modül anahtarları lib/yetki.ts'deki MODULLER ile aynı olmalı
export const izinHaritasiSemasi = z
  .partialRecord(
    z.enum(["calisanlar", "makineler", "devam", "gorevler", "musteriler", "tahsilatlar", "firma"]),
    z.enum(izinSeviyeleri)
  )
  .default({});

// rol: kullanici (izin haritasıyla sınırlı) | admin (tüm ekranlar + onay yetkisi)
export const kullaniciRolleri = ["kullanici", "admin"] as const;
export const kullaniciSemasi = z.object({
  kullaniciAdi,
  adSoyad: z.string().min(1, "Ad soyad zorunlu"),
  sifre: sifreAlani,
  rol: z.enum(kullaniciRolleri).default("kullanici"),
  izinler: izinHaritasiSemasi,
});
export const kullaniciGuncelleSemasi = z.object({
  adSoyad: z.string().min(1).optional(),
  rol: z.enum(kullaniciRolleri).optional(),
  izinler: izinHaritasiSemasi.optional(),
  aktif: z.boolean().optional(),
  sifre: sifreAlani.optional(), // admin şifre sıfırlama
});

// Çalışanı kullanıcı olarak atama (ad soyad çalışandan alınır; onay bekler)
export const calisanKullaniciSemasi = z.object({
  kullaniciAdi,
  sifre: sifreAlani,
  izinler: izinHaritasiSemasi,
});
// Admin onay kararı
export const kullaniciOnaySemasi = z.object({
  karar: z.enum(["onayla", "reddet"]),
});

export const sifreDegistirSemasi = z.object({
  eskiSifre: z.string().min(1, "Mevcut şifre zorunlu"),
  yeniSifre: sifreAlani,
});

// ---- Süper admin: firma yönetimi ----
export const yeniFirmaSemasi = z.object({
  ad: z.string().min(1, "Firma adı zorunlu"),
  adres: z.string().nullish(),
  telefon: z.string().nullish(),
  vergiNo: z.string().nullish(),
  adminKullaniciAdi: kullaniciAdi,
  adminAdSoyad: z.string().min(1, "Admin ad soyad zorunlu"),
  adminSifre: sifreAlani,
});
export const firmaYonetimSemasi = z.object({
  aktif: z.boolean().optional(),
  ad: z.string().min(1).optional(),
});
export const sifreSifirlaSemasi = z.object({ sifre: sifreAlani });
