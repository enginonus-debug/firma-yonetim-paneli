-- AlterTable
ALTER TABLE "Makine" ADD COLUMN     "durumNotu" TEXT,
ADD COLUMN     "sorumluId" INTEGER;

-- AddForeignKey
ALTER TABLE "Makine" ADD CONSTRAINT "Makine_sorumluId_fkey" FOREIGN KEY ("sorumluId") REFERENCES "Calisan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
