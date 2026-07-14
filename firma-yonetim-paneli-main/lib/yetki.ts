import type { Kullanici } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hata } from "@/lib/api";

// İzin verilebilen modüller (ekran/veri alanları). Müşteriler ve satış fırsatları
// tek modül sayılır; panel (dashboard) izinli modüllerin özetini gösterir.
export const MODULLER = [
  "calisanlar",
  "makineler",
  "devam",
  "gorevler",
  "musteriler",
  "tahsilatlar",
  "firma",
] as const;

export type Modul = (typeof MODULLER)[number];
export type IzinSeviyesi = "yok" | "okuma" | "yazma";
export type IzinHaritasi = Partial<Record<Modul, IzinSeviyesi>>;

// Oturumdaki kullanıcıyı veritabanından TAZE okur. Böylece izin değişikliği,
// kullanıcının pasifleştirilmesi veya firmanın askıya alınması, kullanıcı
// çıkış yapmadan anında etki eder (JWT içeriğine güvenilmez).
export async function aktifKullanici(): Promise<Kullanici | null> {
  const oturum = await auth();
  const id = Number(oturum?.user?.id);
  if (!Number.isInteger(id) || id <= 0) return null;

  const kullanici = await prisma.kullanici.findUnique({ where: { id } });
  if (!kullanici || !kullanici.aktif) return null;
  // Onay bekleyen (çalışandan atanmış) hesap hiçbir işlem yapamaz
  if (kullanici.onayDurumu !== "onaylandi") return null;

  if (kullanici.rol !== "superadmin") {
    const firma = await prisma.firma.findUnique({
      where: { id: kullanici.firmaId },
      select: { aktif: true },
    });
    if (!firma?.aktif) return null;
  }
  return kullanici;
}

export function izinSeviyesi(kullanici: Kullanici, modul: Modul): IzinSeviyesi {
  if (kullanici.rol === "admin" || kullanici.rol === "superadmin") return "yazma";
  const izinler = (kullanici.izinler ?? {}) as IzinHaritasi;
  const seviye = izinler[modul];
  return seviye === "okuma" || seviye === "yazma" ? seviye : "yok";
}

type YetkiSonuc =
  | { kullanici: Kullanici; firmaId: number; yanit?: undefined }
  | { kullanici?: undefined; firmaId?: undefined; yanit: Response };

// Firma modülü API'leri için tek giriş noktası: oturum + modül izni denetler.
// GET uçları "okuma", değişiklik yapan uçlar "yazma" ister.
export async function yetki(modul: Modul, seviye: "okuma" | "yazma"): Promise<YetkiSonuc> {
  const kullanici = await aktifKullanici();
  if (!kullanici) return { yanit: hata("Oturum geçersiz veya hesap askıda", 401) };
  if (kullanici.rol === "superadmin") {
    return { yanit: hata("Bu uç firma kullanıcıları içindir; yönetim ekranını kullanın", 403) };
  }
  const sahip = izinSeviyesi(kullanici, modul);
  const yeterli = seviye === "okuma" ? sahip !== "yok" : sahip === "yazma";
  if (!yeterli) return { yanit: hata("Bu işlem için yetkiniz yok", 403) };
  return { kullanici, firmaId: kullanici.firmaId };
}

// Firma admini gerektiren uçlar (kullanıcı yönetimi)
export async function adminYetki(): Promise<YetkiSonuc> {
  const kullanici = await aktifKullanici();
  if (!kullanici) return { yanit: hata("Oturum geçersiz veya hesap askıda", 401) };
  if (kullanici.rol !== "admin") return { yanit: hata("Bu işlem firma adminine özeldir", 403) };
  return { kullanici, firmaId: kullanici.firmaId };
}

// Süper admin gerektiren uçlar (firma yönetimi)
export async function superadminYetki(): Promise<YetkiSonuc> {
  const kullanici = await aktifKullanici();
  if (!kullanici) return { yanit: hata("Oturum geçersiz", 401) };
  if (kullanici.rol !== "superadmin") return { yanit: hata("Bu işlem süper admine özeldir", 403) };
  return { kullanici, firmaId: kullanici.firmaId };
}
