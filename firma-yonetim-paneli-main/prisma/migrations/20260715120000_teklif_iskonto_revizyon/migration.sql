-- Teklif iskonto ve revizyon takibi: onaylı teklife iskonto girilince teklif
-- yeniden onaya düşer; geçmiş olayları (oluşturma/revize/onay/ret) gecmis
-- alanında tutulur ki "ne teklif verildi, nasıl revize edildi" izlenebilsin.
ALTER TABLE "Teklif" ADD COLUMN "iskontoOrani" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Teklif" ADD COLUMN "revizyonNo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Teklif" ADD COLUMN "gecmis" JSONB;
