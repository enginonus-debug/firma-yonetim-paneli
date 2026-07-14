-- Müşteriye e-posta, yetkili irtibat kişisi bilgileri ve firma notları eklenir.
-- Amaç: temsilci değiştiğinde yeni kişinin firma hakkındaki önemli bilgilere erişebilmesi.
ALTER TABLE "Musteri" ADD COLUMN "email" TEXT;
ALTER TABLE "Musteri" ADD COLUMN "yetkiliAd" TEXT;
ALTER TABLE "Musteri" ADD COLUMN "yetkiliUnvan" TEXT;
ALTER TABLE "Musteri" ADD COLUMN "yetkiliTelefon" TEXT;
ALTER TABLE "Musteri" ADD COLUMN "yetkiliEmail" TEXT;
ALTER TABLE "Musteri" ADD COLUMN "notlar" TEXT;
