import { prisma } from "@/lib/db";
import { aktifKullanici } from "@/lib/yetki";
import { govdeDogrula, gunTarihi, hata, ok } from "@/lib/api";
import { takvimNotuSemasi } from "@/lib/semalar";

// Takvim notları kullanıcıya özeldir (modül izni gerekmez); superadmin hariç
// her firma kullanıcısı kendi notlarını yönetir.

// GET /api/takvim?ay=YYYY-MM — o ayın (veya verilmezse içinde bulunulan ayın)
// oturumdaki kullanıcıya ait notları döndürür.
export async function GET(istek: Request) {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);
  if (kullanici.rol === "superadmin") return hata("Bu uç firma kullanıcıları içindir", 403);

  const ay = new URL(istek.url).searchParams.get("ay");
  const eslesme = ay?.match(/^(\d{4})-(\d{2})$/);
  const simdi = new Date();
  const yil = eslesme ? Number(eslesme[1]) : simdi.getUTCFullYear();
  const aySayi = eslesme ? Number(eslesme[2]) - 1 : simdi.getUTCMonth();

  const baslangic = new Date(Date.UTC(yil, aySayi, 1));
  const bitis = new Date(Date.UTC(yil, aySayi + 1, 1));

  const notlar = await prisma.takvimNotu.findMany({
    where: {
      kullaniciId: kullanici.id,
      tarih: { gte: baslangic, lt: bitis },
    },
    select: { id: true, tarih: true, metin: true },
    orderBy: { tarih: "asc" },
  });
  return ok(notlar);
}

// POST /api/takvim — belirli bir güne not ekler (gövde: { tarih, metin })
export async function POST(istek: Request) {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);
  if (kullanici.rol === "superadmin") return hata("Bu uç firma kullanıcıları içindir", 403);

  const sonuc = await govdeDogrula(istek, takvimNotuSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  const not = await prisma.takvimNotu.create({
    data: {
      firmaId: kullanici.firmaId,
      kullaniciId: kullanici.id,
      tarih: gunTarihi(sonuc.veri.tarih),
      metin: sonuc.veri.metin.trim(),
    },
    select: { id: true, tarih: true, metin: true },
  });
  return ok(not, 201);
}
