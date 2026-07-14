import { aktifKullanici, izinSeviyesi, MODULLER } from "@/lib/yetki";
import { hata, ok } from "@/lib/api";

// GET /api/hesap — oturumdaki kullanıcının kendi bilgisi ve etkin izinleri
// (menü ve ekranlar bunu kullanarak neyi gösterip gizleyeceğine karar verir)
export async function GET() {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);

  const izinler = Object.fromEntries(
    MODULLER.map((m) => [m, izinSeviyesi(kullanici, m)])
  );

  return ok({
    id: kullanici.id,
    kullaniciAdi: kullanici.email,
    adSoyad: kullanici.adSoyad,
    rol: kullanici.rol,
    izinler,
  });
}
