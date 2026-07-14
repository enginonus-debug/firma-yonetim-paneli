import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// "YYYY-MM-DD" -> UTC gece yarısı (@db.Date alanlarıyla uyumlu)
function gun(t: string) {
  return new Date(`${t}T00:00:00.000Z`);
}

function bugun(kaydir = 0) {
  const simdi = new Date();
  const t = new Date(Date.UTC(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()));
  t.setUTCDate(t.getUTCDate() + kaydir);
  return t;
}

async function main() {
  // 1) Firma (tek kayıt)
  await prisma.firma.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      ad: "Örnek Mobilya Atölyesi",
      adres: "Sanayi Sitesi 3. Blok No: 12, Ankara",
      telefon: "0312 000 00 00",
      vergiNo: "1234567890",
    },
  });

  // Firma sabit id ile eklendiği için otomatik id sayacını ileri al;
  // yoksa süper adminin ekleyeceği ilk firma id çakışmasıyla patlar
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Firma"', 'id'), (SELECT COALESCE(MAX(id),1) FROM "Firma"))`
  );

  // 2) Süper admin (ürün sahibi) — giriş: admin / admin123
  const sifreHash = await bcrypt.hash("admin123", 10);
  await prisma.kullanici.deleteMany({ where: { email: "admin@firma.local" } });
  await prisma.kullanici.upsert({
    where: { email: "admin" },
    update: { sifreHash, adSoyad: "Süper Admin", rol: "superadmin" },
    create: {
      email: "admin",
      adSoyad: "Süper Admin",
      sifreHash,
      rol: "superadmin",
    },
  });

  // 2b) Örnek firmanın admini — giriş: demo / demo123
  const demoHash = await bcrypt.hash("demo123", 10);
  await prisma.kullanici.upsert({
    where: { email: "demo" },
    update: { sifreHash: demoHash, adSoyad: "Demo Firma Admini", rol: "admin", firmaId: 1 },
    create: {
      email: "demo",
      adSoyad: "Demo Firma Admini",
      sifreHash: demoHash,
      rol: "admin",
      firmaId: 1,
    },
  });

  // 3) Örnek veriler (yalnızca boş veritabanına eklenir)
  if ((await prisma.calisan.count()) > 0) {
    console.log("Örnek veriler zaten mevcut, atlandı.");
    return;
  }

  const ahmet = await prisma.calisan.create({
    data: { adSoyad: "Ahmet Yılmaz", pozisyon: "Usta (CNC)", telefon: "0532 000 00 01", iseBaslama: gun("2022-03-01") },
  });
  const mehmet = await prisma.calisan.create({
    data: { adSoyad: "Mehmet Demir", pozisyon: "Montaj", telefon: "0532 000 00 02", iseBaslama: gun("2023-06-15") },
  });
  const ayse = await prisma.calisan.create({
    data: { adSoyad: "Ayşe Kaya", pozisyon: "Satış & Pazarlama", telefon: "0532 000 00 03", iseBaslama: gun("2024-01-08") },
  });

  const cnc = await prisma.makine.create({
    data: { ad: "CNC Freze", model: "Biesse Rover A", seriNo: "CNC-2021-001", durum: "calisiyor" },
  });
  await prisma.makine.create({
    data: { ad: "Şerit Testere", model: "Makita LB1200F", seriNo: "ST-2019-004", durum: "bakimda" },
  });
  await prisma.makine.create({
    data: { ad: "Kenar Bantlama", model: "Felder G330", seriNo: "KB-2020-002", durum: "calisiyor" },
  });

  const yildiz = await prisma.musteri.create({
    data: { ad: "Yıldız Mobilya Mağazası", telefon: "0312 111 11 11", adres: "Siteler, Ankara" },
  });
  const kaplan = await prisma.musteri.create({
    data: { ad: "Kaplan İnşaat", telefon: "0312 222 22 22", adres: "Çankaya, Ankara", vergiNo: "9876543210" },
  });

  // Örnek panel kullanıcısı (giriş: usta / usta123) — Ahmet'e bağlı, onaylı.
  // Görevler yalnızca giriş bilgisi olan panel kullanıcılarına atanabildiğinden
  // demo atama için bu hesap kullanılır.
  const demoAdmin = await prisma.kullanici.findUnique({ where: { email: "demo" } });
  const ustaHash = await bcrypt.hash("usta123", 10);
  const usta = await prisma.kullanici.upsert({
    where: { email: "usta" },
    update: {},
    create: {
      email: "usta",
      adSoyad: "Ahmet Yılmaz",
      sifreHash: ustaHash,
      rol: "kullanici",
      firmaId: 1,
      calisanId: ahmet.id,
      onayDurumu: "onaylandi",
      izinler: { gorevler: "yazma", makineler: "okuma", musteriler: "okuma" },
    },
  });

  // Görevler: atanan = usta, denetçi = demo admin
  await prisma.gorev.create({
    data: {
      baslik: "20 adet sandalye iskeleti kesimi",
      aciklama: "Yıldız Mobilya siparişi için kayın iskelet kesimi",
      makineId: cnc.id,
      durum: "devam_ediyor",
      oncelik: "yuksek",
      baslangic: bugun(-2),
      bitis: bugun(5),
      atamalar: {
        create: [
          { kullaniciId: usta.id, rol: "atanan" },
          ...(demoAdmin ? [{ kullaniciId: demoAdmin.id, rol: "denetci" }] : []),
        ],
      },
    },
  });
  await prisma.gorev.create({
    data: {
      baslik: "Vestiyer montajı",
      durum: "bekliyor",
      oncelik: "normal",
      bitis: bugun(7),
      atamalar: { create: [{ kullaniciId: usta.id, rol: "atanan" }] },
    },
  });
  await prisma.gorev.create({
    data: {
      baslik: "Numune sehpa cilalama",
      durum: "tamamlandi",
      oncelik: "dusuk",
      baslangic: bugun(-10),
      bitis: bugun(-3),
    },
  });

  await prisma.devam.createMany({
    data: [
      { calisanId: ahmet.id, tarih: bugun(), durum: "geldi", girisSaat: "08:00" },
      { calisanId: mehmet.id, tarih: bugun(), durum: "geldi", girisSaat: "08:15" },
      { calisanId: ayse.id, tarih: bugun(), durum: "izinli" },
    ],
  });

  const kazanilan = await prisma.satisFirsati.create({
    data: {
      musteriId: yildiz.id,
      sorumluId: ayse.id,
      baslik: "20 masa siparişi",
      durum: "kazanildi",
      tutar: 120000,
      tarih: bugun(-30),
    },
  });
  const gorusulen = await prisma.satisFirsati.create({
    data: {
      musteriId: yildiz.id,
      sorumluId: ayse.id,
      baslik: "50 adet yemek masası",
      durum: "gorusuluyor",
      tutar: 250000,
      tarih: bugun(-7),
    },
  });

  // Örnek fiyat teklifi — görüşülen fırsattan, demo admin onayını bekliyor
  if (demoAdmin) {
    const kalemler = [
      { aciklama: "Meşe yemek masası (200x100 cm)", miktar: 50, birim: "adet", birimFiyat: 4200 },
      { aciklama: "Nakliye ve montaj", miktar: 1, birim: "hizmet", birimFiyat: 15000 },
    ];
    const araToplam = kalemler.reduce((t, k) => t + k.miktar * k.birimFiyat, 0);
    await prisma.teklif.create({
      data: {
        satisFirsatiId: gorusulen.id,
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
  await prisma.satisFirsati.create({
    data: {
      musteriId: kaplan.id,
      sorumluId: ayse.id,
      baslik: "Şantiye ofisi dolapları",
      durum: "potansiyel",
      tutar: 80000,
    },
  });

  await prisma.tahsilat.createMany({
    data: [
      {
        musteriId: yildiz.id,
        satisFirsatiId: kazanilan.id,
        tutar: 60000,
        vadeTarihi: bugun(-14),
        odemeTarihi: bugun(-12),
        durum: "tahsil_edildi",
        odemeYontemi: "havale",
      },
      {
        musteriId: yildiz.id,
        satisFirsatiId: kazanilan.id,
        tutar: 60000,
        vadeTarihi: bugun(14),
        durum: "bekliyor",
      },
      {
        // vadesi geçmiş kayıt — API otomatik "gecikti" işaretleyecek
        musteriId: kaplan.id,
        tutar: 25000,
        vadeTarihi: bugun(-5),
        durum: "bekliyor",
      },
    ],
  });

  console.log("Örnek veriler eklendi.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
