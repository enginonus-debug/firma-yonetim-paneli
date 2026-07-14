-- Kişisel takvim notu: kullanıcının belirli bir güne eklediği hatırlatma.
CREATE TABLE "TakvimNotu" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "kullaniciId" INTEGER NOT NULL,
    "tarih" DATE NOT NULL,
    "metin" TEXT NOT NULL,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TakvimNotu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TakvimNotu_kullaniciId_tarih_idx" ON "TakvimNotu"("kullaniciId", "tarih");

-- AddForeignKey
ALTER TABLE "TakvimNotu" ADD CONSTRAINT "TakvimNotu_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE CASCADE ON UPDATE CASCADE;
