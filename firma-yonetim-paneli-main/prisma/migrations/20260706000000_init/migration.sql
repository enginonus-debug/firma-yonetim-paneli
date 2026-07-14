-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Firma" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "adres" TEXT,
    "telefon" TEXT,
    "vergiNo" TEXT,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kullanici" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "email" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'yonetici',
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Kullanici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calisan" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "adSoyad" TEXT NOT NULL,
    "pozisyon" TEXT,
    "telefon" TEXT,
    "iseBaslama" DATE,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Calisan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Makine" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "ad" TEXT NOT NULL,
    "model" TEXT,
    "seriNo" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'calisiyor',

    CONSTRAINT "Makine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devam" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "calisanId" INTEGER NOT NULL,
    "tarih" DATE NOT NULL,
    "girisSaat" TEXT,
    "cikisSaat" TEXT,
    "durum" TEXT NOT NULL,

    CONSTRAINT "Devam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gorev" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "calisanId" INTEGER,
    "makineId" INTEGER,
    "baslik" TEXT NOT NULL,
    "aciklama" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'bekliyor',
    "oncelik" TEXT,
    "baslangic" DATE,
    "bitis" DATE,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gorev_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Musteri" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "ad" TEXT NOT NULL,
    "telefon" TEXT,
    "adres" TEXT,
    "vergiNo" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Musteri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatisFirsati" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "musteriId" INTEGER NOT NULL,
    "sorumluId" INTEGER,
    "baslik" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'potansiyel',
    "tutar" DECIMAL(12,2),
    "tarih" DATE,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SatisFirsati_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tahsilat" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "musteriId" INTEGER NOT NULL,
    "satisFirsatiId" INTEGER,
    "tutar" DECIMAL(12,2) NOT NULL,
    "vadeTarihi" DATE,
    "odemeTarihi" DATE,
    "durum" TEXT NOT NULL DEFAULT 'bekliyor',
    "odemeYontemi" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tahsilat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_email_key" ON "Kullanici"("email");

-- CreateIndex
CREATE INDEX "Kullanici_firmaId_idx" ON "Kullanici"("firmaId");

-- CreateIndex
CREATE INDEX "Calisan_firmaId_aktif_idx" ON "Calisan"("firmaId", "aktif");

-- CreateIndex
CREATE INDEX "Makine_firmaId_idx" ON "Makine"("firmaId");

-- CreateIndex
CREATE INDEX "Devam_firmaId_tarih_idx" ON "Devam"("firmaId", "tarih");

-- CreateIndex
CREATE UNIQUE INDEX "Devam_calisanId_tarih_key" ON "Devam"("calisanId", "tarih");

-- CreateIndex
CREATE INDEX "Gorev_firmaId_durum_idx" ON "Gorev"("firmaId", "durum");

-- CreateIndex
CREATE INDEX "Musteri_firmaId_idx" ON "Musteri"("firmaId");

-- CreateIndex
CREATE INDEX "SatisFirsati_firmaId_durum_idx" ON "SatisFirsati"("firmaId", "durum");

-- CreateIndex
CREATE INDEX "Tahsilat_firmaId_durum_idx" ON "Tahsilat"("firmaId", "durum");

-- CreateIndex
CREATE INDEX "Tahsilat_firmaId_vadeTarihi_idx" ON "Tahsilat"("firmaId", "vadeTarihi");

-- AddForeignKey
ALTER TABLE "Devam" ADD CONSTRAINT "Devam_calisanId_fkey" FOREIGN KEY ("calisanId") REFERENCES "Calisan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gorev" ADD CONSTRAINT "Gorev_calisanId_fkey" FOREIGN KEY ("calisanId") REFERENCES "Calisan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gorev" ADD CONSTRAINT "Gorev_makineId_fkey" FOREIGN KEY ("makineId") REFERENCES "Makine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisFirsati" ADD CONSTRAINT "SatisFirsati_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "Musteri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisFirsati" ADD CONSTRAINT "SatisFirsati_sorumluId_fkey" FOREIGN KEY ("sorumluId") REFERENCES "Calisan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tahsilat" ADD CONSTRAINT "Tahsilat_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "Musteri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tahsilat" ADD CONSTRAINT "Tahsilat_satisFirsatiId_fkey" FOREIGN KEY ("satisFirsatiId") REFERENCES "SatisFirsati"("id") ON DELETE SET NULL ON UPDATE CASCADE;

