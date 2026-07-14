// Tek seferlik, veri kaybı olmayan zenginleştirme: yeni görev-atama ve teklif
// özelliklerini mevcut demo veritabanında göstermek için örnek kayıtlar ekler.
// Çalıştırma: npx tsx scripts/demo-zenginlestir.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function bugun(kaydir = 0) {
  const s = new Date();
  const t = new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()));
  t.setUTCDate(t.getUTCDate() + kaydir);
  return t;
}

async function main() {
  const ahmet = await prisma.calisan.findFirst({ where: { adSoyad: "Ahmet Yılmaz" } });
  const demoAdmin = await prisma.kullanici.findUnique({ where: { email: "demo" } });

  // Örnek panel kullanıcısı (usta / usta123), Ahmet'e bağlı ve onaylı
  const usta = await prisma.kullanici.upsert({
    where: { email: "usta" },
    update: {},
    create: {
      email: "usta",
      adSoyad: "Ahmet Yılmaz",
      sifreHash: await bcrypt.hash("usta123", 10),
      rol: "kullanici",
      firmaId: 1,
      calisanId: ahmet?.id ?? null,
      onayDurumu: "onaylandi",
      izinler: { gorevler: "yazma", makineler: "okuma", musteriler: "okuma" },
    },
  });

  // Atamasız görevlere örnek atama ekle (atanan = usta, denetçi = demo admin)
  const gorevler = await prisma.gorev.findMany({
    where: { atamalar: { none: {} } },
    take: 2,
  });
  for (const g of gorevler) {
    await prisma.gorevAtama.createMany({
      data: [
        { gorevId: g.id, kullaniciId: usta.id, rol: "atanan" },
        ...(demoAdmin ? [{ gorevId: g.id, kullaniciId: demoAdmin.id, rol: "denetci" }] : []),
      ],
      skipDuplicates: true,
    });
  }

  // Örnek teklif — görüşülen fırsattan, demo admin onayını bekliyor
  const firsat = await prisma.satisFirsati.findFirst({ where: { durum: "gorusuluyor" } });
  const teklifVar = await prisma.teklif.count();
  if (firsat && demoAdmin && teklifVar === 0) {
    const kalemler = [
      { aciklama: "Meşe yemek masası (200x100 cm)", miktar: 50, birim: "adet", birimFiyat: 4200 },
      { aciklama: "Nakliye ve montaj", miktar: 1, birim: "hizmet", birimFiyat: 15000 },
    ];
    const araToplam = kalemler.reduce((t, k) => t + k.miktar * k.birimFiyat, 0);
    await prisma.teklif.create({
      data: {
        satisFirsatiId: firsat.id,
        baslik: "50 adet meşe yemek masası teklifi",
        kalemler,
        kdvOrani: 20,
        araToplam,
        toplam: araToplam * 1.2,
        gecerlilikTarihi: bugun(15),
        notlar: "Fiyata cila ve teslimat dahildir. Ödeme: %50 peşin, %50 teslimde.",
        durum: "onay_bekliyor",
        onaylayanId: demoAdmin.id,
      },
    });
  }

  console.log("Demo zenginleştirme tamam.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
