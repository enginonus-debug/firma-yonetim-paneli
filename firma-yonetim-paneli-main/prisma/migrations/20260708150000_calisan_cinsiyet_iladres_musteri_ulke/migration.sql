-- Çalışan: cinsiyet + il/ilçe (filtreleme için); Müşteri: yabancı için ülke kodu.
ALTER TABLE "Calisan" ADD COLUMN "cinsiyet" TEXT;
ALTER TABLE "Calisan" ADD COLUMN "il" TEXT;
ALTER TABLE "Calisan" ADD COLUMN "ilce" TEXT;
ALTER TABLE "Musteri" ADD COLUMN "ulkeKodu" TEXT NOT NULL DEFAULT '+90';
