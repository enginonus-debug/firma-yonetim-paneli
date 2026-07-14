import type { Kullanici } from "@prisma/client";
import { prisma } from "@/lib/db";

// Denetim kaydı (audit log) yardımcıları.
// Her değişiklik yapan API ucu, işlem başarıyla bittikten sonra denetimKaydet()
// çağırır; böylece kim, ne zaman, hangi ekranda, neyi değiştirdi izi kalır.
// Kayıtları yalnızca admin görüntüler (app/api/kayitlar).

// İşlem türleri — UI'daki etiketler app/(panel)/kayitlar sayfasında eşlenir
export type DenetimIslem =
  | "ekleme"
  | "guncelleme"
  | "silme"
  | "pasife-alma"
  | "sifre-degistirme"
  | "ozel-bilgi-goruntuleme"
  | "onay-talebi" // çalışan kullanıcı olarak atandı, admin onayı bekliyor
  | "onaylama"
  | "reddetme";

// Değeri asla açık yazılmayacak alanlar (şifre vb.)
const GIZLI_ALANLAR = new Set(["sifre", "sifreHash", "eskiSifre", "yeniSifre", "adminSifre", "parola"]);
// Kayda sığmayacak kadar büyük alanlar (data-URL fotoğraf/logo)
const BUYUK_ALANLAR = new Set(["foto", "logo"]);

// Date/Decimal gibi değerleri karşılaştırılabilir, okunur hâle getirir
function duzlestir(deger: unknown): unknown {
  if (deger instanceof Date) {
    const iso = deger.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (
    deger !== null &&
    typeof deger === "object" &&
    "toNumber" in deger &&
    typeof (deger as { toNumber: unknown }).toNumber === "function"
  ) {
    return (deger as { toNumber: () => number }).toNumber(); // Prisma Decimal
  }
  return deger;
}

export type DegisiklikHaritasi = Record<string, { eski: unknown; yeni: unknown }>;

// Gönderilen verideki alanları mevcut kayıtla karşılaştırıp yalnızca
// DEĞİŞEN alanları { alan: { eski, yeni } } biçiminde döndürür.
// Yeni kayıt için eski=null verilir; hiç değişiklik yoksa undefined döner.
export function degisiklikOzeti(
  eski: Record<string, unknown> | null,
  yeni: Record<string, unknown>
): DegisiklikHaritasi | undefined {
  const fark: DegisiklikHaritasi = {};
  for (const [alan, deger] of Object.entries(yeni)) {
    if (deger === undefined) continue; // gönderilmeyen alan = değişiklik yok

    if (GIZLI_ALANLAR.has(alan)) {
      fark[alan] = { eski: eski ? "(gizli)" : null, yeni: "(gizli)" };
      continue;
    }

    const eskiDeger = duzlestir(eski?.[alan] ?? null);
    const yeniDeger = duzlestir(deger ?? null);
    if (JSON.stringify(eskiDeger) === JSON.stringify(yeniDeger)) continue;

    if (BUYUK_ALANLAR.has(alan)) {
      fark[alan] = { eski: eski?.[alan] ? "(önceki görsel)" : null, yeni: deger ? "(yeni görsel)" : null };
    } else {
      fark[alan] = { eski: eskiDeger, yeni: yeniDeger };
    }
  }
  return Object.keys(fark).length > 0 ? fark : undefined;
}

// Denetim kaydını yazar. Kayıt yazılamazsa ana işlem geri alınamayacağı için
// istek DÜŞÜRÜLMEZ; hata sunucu günlüğüne yazılır.
export async function denetimKaydet(girdi: {
  kullanici: Kullanici; // oturum sahibi (ayak izi buradan alınır)
  ekran: string; // hangi ekran/modül: calisanlar | makineler | ... | kullanicilar | hesap | yonetim
  islem: DenetimIslem;
  hedefTip?: string; // etkilenen kayıt türü, ör. "Çalışan"
  hedefId?: number;
  hedefAd?: string | null;
  detay?: DegisiklikHaritasi;
  firmaId?: number; // superadmin başka firmada işlem yaptığında hedef firma
}) {
  try {
    await prisma.denetimKaydi.create({
      data: {
        firmaId: girdi.firmaId ?? girdi.kullanici.firmaId,
        kullaniciId: girdi.kullanici.id,
        kullaniciAd: girdi.kullanici.adSoyad,
        kullaniciEmail: girdi.kullanici.email,
        kullaniciRol: girdi.kullanici.rol,
        ekran: girdi.ekran,
        islem: girdi.islem,
        hedefTip: girdi.hedefTip,
        hedefId: girdi.hedefId,
        hedefAd: girdi.hedefAd ?? undefined,
        detay: girdi.detay as object | undefined,
      },
    });
  } catch (e) {
    console.error("Denetim kaydı yazılamadı:", e);
  }
}
