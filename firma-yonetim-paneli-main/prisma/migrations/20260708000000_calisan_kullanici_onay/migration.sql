-- AlterTable
ALTER TABLE "Kullanici" ADD COLUMN     "calisanId" INTEGER,
ADD COLUMN     "onayDurumu" TEXT NOT NULL DEFAULT 'onaylandi';

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_calisanId_key" ON "Kullanici"("calisanId");

-- AddForeignKey
ALTER TABLE "Kullanici" ADD CONSTRAINT "Kullanici_calisanId_fkey" FOREIGN KEY ("calisanId") REFERENCES "Calisan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

