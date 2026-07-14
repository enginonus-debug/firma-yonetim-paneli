-- Görev iş akışı: oluşturan (atayan) takibi + red notu; ve bildirim sistemi.

-- AlterTable: Gorev
ALTER TABLE "Gorev" ADD COLUMN "olusturanId" INTEGER;
ALTER TABLE "Gorev" ADD COLUMN "redNotu" TEXT;

-- AddForeignKey
ALTER TABLE "Gorev" ADD CONSTRAINT "Gorev_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Bildirim
CREATE TABLE "Bildirim" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "kullaniciId" INTEGER NOT NULL,
    "tip" TEXT NOT NULL,
    "mesaj" TEXT NOT NULL,
    "gorevId" INTEGER,
    "okundu" BOOLEAN NOT NULL DEFAULT false,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bildirim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bildirim_kullaniciId_okundu_olusturma_idx" ON "Bildirim"("kullaniciId", "okundu", "olusturma");

-- AddForeignKey
ALTER TABLE "Bildirim" ADD CONSTRAINT "Bildirim_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE CASCADE ON UPDATE CASCADE;
