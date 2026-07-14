-- CreateTable
CREATE TABLE "DenetimKaydi" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "kullaniciId" INTEGER,
    "kullaniciAd" TEXT NOT NULL,
    "kullaniciEmail" TEXT NOT NULL,
    "kullaniciRol" TEXT NOT NULL,
    "ekran" TEXT NOT NULL,
    "islem" TEXT NOT NULL,
    "hedefTip" TEXT,
    "hedefId" INTEGER,
    "hedefAd" TEXT,
    "detay" JSONB,
    "zaman" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DenetimKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DenetimKaydi_firmaId_zaman_idx" ON "DenetimKaydi"("firmaId", "zaman");
