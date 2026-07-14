-- CreateTable
CREATE TABLE "MakineOlay" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "makineId" INTEGER NOT NULL,
    "tip" TEXT NOT NULL,
    "aciklama" TEXT NOT NULL,
    "sorumluId" INTEGER,
    "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitis" TIMESTAMP(3),

    CONSTRAINT "MakineOlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MakineOlay_firmaId_makineId_baslangic_idx" ON "MakineOlay"("firmaId", "makineId", "baslangic");

-- AddForeignKey
ALTER TABLE "MakineOlay" ADD CONSTRAINT "MakineOlay_makineId_fkey" FOREIGN KEY ("makineId") REFERENCES "Makine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakineOlay" ADD CONSTRAINT "MakineOlay_sorumluId_fkey" FOREIGN KEY ("sorumluId") REFERENCES "Calisan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
