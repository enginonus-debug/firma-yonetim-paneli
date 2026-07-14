import { prisma } from "@/lib/db";
import { aktifKullanici } from "@/lib/yetki";
import { hata, idAl, ok } from "@/lib/api";

// PATCH /api/bildirimler/:id — kullanıcının kendi bildirimini okundu işaretler
// (bildirime tıklandığında çağrılır).
export async function PATCH(_istek: Request, baglam: { params: Promise<{ id: string }> }) {
  const kullanici = await aktifKullanici();
  if (!kullanici) return hata("Oturum geçersiz veya hesap askıda", 401);

  const id = idAl((await baglam.params).id);
  if (!id) return hata("Geçersiz id");

  const { count } = await prisma.bildirim.updateMany({
    where: { id, kullaniciId: kullanici.id },
    data: { okundu: true },
  });
  if (count === 0) return hata("Bildirim bulunamadı", 404);
  return ok({ mesaj: "Okundu" });
}
