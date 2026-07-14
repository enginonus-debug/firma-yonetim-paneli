-- Teklif karar anında dondurulan firma/müşteri/kişi kopyası (snapshot).
-- Karara bağlanmış teklifin çıktısı bu kopyadan beslenir; sistemdeki sonraki
-- değişiklikler onaylı teklifi etkilemez.
ALTER TABLE "Teklif" ADD COLUMN "anlikVeri" JSONB;
