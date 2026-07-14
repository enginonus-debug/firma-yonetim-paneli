import { prisma } from "@/lib/db";
import { aktifKullanici } from "@/lib/yetki";
import { govdeDogrula, hata, idAl, ok } from "@/lib/api";
import { takvimNotuGuncelleSemasi } from "@/lib/semalar";

type Baglam = { params: Promise<{ id: string }> };

// PUT /api/takvim/:id — kullanıcının kendi notunu düzenler
export async function PUT(istek: Request, { params }: Baglam) {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const sonuc = await govdeDogrula(istek, takvimNotuGuncelleSemasi);
  if (sonuc.yanit) return sonuc.yanit;

  // Yalnızca kendi notu (kullaniciId filtresiyle güvence altında)
  const { count } = await prisma.takvimNotu.updateMany({
    where: { id, kullaniciId: kullanici.id },
    data: { metin: sonuc.veri.metin.trim() },
  });
  if (count === 0) return hata("Not bulunamadı", 404);

  const not = await prisma.takvimNotu.findUnique({
    where: { id },
    select: { id: true, tarih: true, metin: true },
  });
  return ok(not);
}

// DELETE /api/takvim/:id — kullanıcının kendi notunu siler
export async function DELETE(_istek: Request, { params }: Baglam) {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);

  const id = idAl((await params).id);
  if (!id) return hata("Geçersiz id");

  const { count } = await prisma.takvimNotu.deleteMany({
    where: { id, kullaniciId: kullanici.id },
  });
  if (count === 0) return hata("Not bulunamadı", 404);
  return ok({ mesaj: "Not silindi" });
}
