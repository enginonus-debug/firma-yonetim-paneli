-- AlterTable
ALTER TABLE "Calisan" ADD COLUMN     "dogumTarihi" DATE,
ADD COLUMN     "engelDurumu" TEXT,
ADD COLUMN     "engelli" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "istenAyrilma" DATE,
ADD COLUMN     "maas" DECIMAL(12,2),
ADD COLUMN     "tcKimlikNo" TEXT;
