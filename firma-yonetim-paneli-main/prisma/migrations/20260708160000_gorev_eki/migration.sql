-- Görev eki: görev belgesi (tur='gorev') veya tamamlama/sonuç belgesi (tur='sonuc').
CREATE TABLE "GorevEki" (
    "id" SERIAL NOT NULL,
    "firmaId" INTEGER NOT NULL DEFAULT 1,
    "gorevId" INTEGER NOT NULL,
    "tur" TEXT NOT NULL DEFAULT 'gorev',
    "dosyaAd" TEXT NOT NULL,
    "mimeTip" TEXT NOT NULL,
    "boyut" INTEGER NOT NULL,
    "veri" BYTEA NOT NULL,
    "yukleyenId" INTEGER,
    "yukleyenAd" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GorevEki_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GorevEki_gorevId_idx" ON "GorevEki"("gorevId");

-- AddForeignKey
ALTER TABLE "GorevEki" ADD CONSTRAINT "GorevEki_gorevId_fkey" FOREIGN KEY ("gorevId") REFERENCES "Gorev"("id") ON DELETE CASCADE ON UPDATE CASCADE;
