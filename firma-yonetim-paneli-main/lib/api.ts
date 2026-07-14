import { NextResponse } from "next/server";
import { z } from "zod";

// firmaId artık oturumdan gelir (lib/yetki.ts) — istek gövdesinden/URL'den
// ASLA okunmaz (kiracılar arası veri sızıntısını önlemek için).

// Çalışan özel bilgilerini (maaş, adres vb.) görüntüleme parolası.
// Şimdilik sabit; ileride kullanıcı bazlı yetkiye taşınacak.
export const DETAY_PAROLASI = process.env.DETAY_PAROLA ?? "1234";

export function ok(veri: unknown, status = 200) {
  return NextResponse.json(veri, { status });
}

export function hata(mesaj: string, status = 400) {
  return NextResponse.json({ hata: mesaj }, { status });
}

// İstek gövdesini JSON olarak okuyup zod şemasıyla doğrular.
// Hata varsa doğrudan döndürülecek yanıtı verir.
export async function govdeDogrula<S extends z.ZodTypeAny>(
  istek: Request,
  sema: S
): Promise<{ veri: z.infer<S>; yanit?: undefined } | { veri?: undefined; yanit: NextResponse }> {
  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return { yanit: hata("Geçersiz JSON gövdesi") };
  }
  const sonuc = sema.safeParse(govde);
  if (!sonuc.success) {
    const ilk = sonuc.error.issues[0];
    const alan = ilk.path.join(".");
    return { yanit: hata(alan ? `${alan}: ${ilk.message}` : ilk.message) };
  }
  return { veri: sonuc.data };
}

// URL parametresinden pozitif tamsayı id çözer
export function idAl(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Mobil-dostu sayfalama: ?sayfa=1&limit=20 (en fazla 100)
export function sayfalama(url: URL) {
  const sayfa = Math.max(1, Number(url.searchParams.get("sayfa")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  return { sayfa, limit, skip: (sayfa - 1) * limit, take: limit };
}

// Prisma hata kodunu okur (P2003: yabancı anahtar, P2025: kayıt bulunamadı, P2002: benzersizlik)
export function prismaHataKodu(e: unknown): string | null {
  if (e && typeof e === "object" && "code" in e && typeof e.code === "string") {
    return e.code;
  }
  return null;
}

// "YYYY-MM-DD" -> UTC gece yarısı Date (@db.Date alanlarıyla uyumlu)
export function gunTarihi(t: string): Date {
  return new Date(`${t}T00:00:00.000Z`);
}

// Bugünün tarihi (saat kısmı olmadan, UTC)
export function bugun(): Date {
  const simdi = new Date();
  return new Date(Date.UTC(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()));
}
