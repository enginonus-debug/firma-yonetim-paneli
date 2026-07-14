-- Görevlerde çoklu kullanıcı ataması (atanan/denetçi/kontrolör) ve
-- fiyat teklifi onay akışı (Teklif + TeklifEki), fırsat kayıp nedeni.

-- CreateTable
CREATE TABLE "GorevAtama" (
    "id" SERIAL NOT NULL,
    "gorevId" INTEGER NOT NULL,
    "kullaniciId" INTEGER NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'atanan',

    CONSTRAINT "GorevAtama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teklif" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "satisFirsatiId" INTEGER NOT NULL,
    "baslik" TEXT NOT NULL,
    "kalemler" JSONB NOT NULL,
    "kdvOrani" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "araToplam" DECIMAL(14,2) NOT NULL,
    "toplam" DECIMAL(14,2) NOT NULL,
    "gecerlilikTarihi" DATE,
    "notlar" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'onay_bekliyor',
    "olusturanId" INTEGER,
    "onaylayanId" INTEGER,
    "kararNotu" TEXT,
    "kararZamani" TIMESTAMP(3),
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Teklif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeklifEki" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "teklifId" INTEGER NOT NULL,
    "dosyaAd" TEXT NOT NULL,
    "mimeTip" TEXT NOT NULL,
    "boyut" INTEGER NOT NULL,
    "veri" BYTEA NOT NULL,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeklifEki_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GorevAtama_kullaniciId_idx" ON "GorevAtama"("kullaniciId");

-- CreateIndex
CREATE UNIQUE INDEX "GorevAtama_gorevId_kullaniciId_rol_key" ON "GorevAtama"("gorevId", "kullaniciId", "rol");

-- CreateIndex
CREATE INDEX "Teklif_firmaId_durum_idx" ON "Teklif"("firmaId", "durum");

-- CreateIndex
CREATE INDEX "Teklif_satisFirsatiId_idx" ON "Teklif"("satisFirsatiId");

-- CreateIndex
CREATE INDEX "TeklifEki_teklifId_idx" ON "TeklifEki"("teklifId");

-- AddForeignKey
ALTER TABLE "GorevAtama" ADD CONSTRAINT "GorevAtama_gorevId_fkey" FOREIGN KEY ("gorevId") REFERENCES "Gorev"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GorevAtama" ADD CONSTRAINT "GorevAtama_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_satisFirsatiId_fkey" FOREIGN KEY ("satisFirsatiId") REFERENCES "SatisFirsati"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_onaylayanId_fkey" FOREIGN KEY ("onaylayanId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeklifEki" ADD CONSTRAINT "TeklifEki_teklifId_fkey" FOREIGN KEY ("teklifId") REFERENCES "Teklif"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Veri taşıma: eski çalışan atamalarını, o çalışana bağlı panel kullanıcısı
-- varsa yeni atama tablosuna aktar (kullanıcısı olmayan çalışan atamaları düşer)
INSERT INTO "GorevAtama" ("gorevId", "kullaniciId", "rol")
SELECT g."id", k."id", 'atanan'
FROM "Gorev" g
JOIN "Kullanici" k ON k."calisanId" = g."calisanId"
WHERE g."calisanId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Gorev" DROP CONSTRAINT "Gorev_calisanId_fkey";

-- AlterTable
ALTER TABLE "Gorev" DROP COLUMN "calisanId";

-- AlterTable
ALTER TABLE "SatisFirsati" ADD COLUMN     "kayipNedeni" TEXT;
