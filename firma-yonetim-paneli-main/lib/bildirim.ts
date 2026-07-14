import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Bildirim (uyarı) oluşturma yardımcıları. Görev iş akışının olaylarında
// ilgili kullanıcılara panelde görünecek uyarılar üretilir.

export type BildirimTip =
  | "atama"
  | "kontrol_bekliyor"
  | "denetim_bekliyor"
  | "tamamlandi"
  | "reddedildi";

// Birden çok kullanıcıya aynı bildirimi oluşturur (kendine bildirim gönderilmez).
export async function bildirimGonder(
  tx: Prisma.TransactionClient | typeof prisma,
  girdi: {
    firmaId: number;
    kullaniciIdler: number[]; // alıcılar
    tip: BildirimTip;
    mesaj: string;
    gorevId?: number;
    haric?: number; // bu kullanıcıya gönderme (ör. işlemi yapan kişi)
  }
) {
  const alicilar = [...new Set(girdi.kullaniciIdler)].filter(
    (id) => id && id !== girdi.haric
  );
  if (alicilar.length === 0) return;
  await tx.bildirim.createMany({
    data: alicilar.map((kullaniciId) => ({
      firmaId: girdi.firmaId,
      kullaniciId,
      tip: girdi.tip,
      mesaj: girdi.mesaj,
      gorevId: girdi.gorevId,
    })),
  });
}
