-- AlterTable
ALTER TABLE "Firma" ADD COLUMN     "aktif" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Kullanici" ADD COLUMN     "aktif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "izinler" JSONB,
ALTER COLUMN "rol" SET DEFAULT 'kullanici';
