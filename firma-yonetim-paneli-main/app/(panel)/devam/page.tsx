"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays } from "lucide-react";
import { buAyStr, bugunStr } from "@/lib/format";

type Calisan = { id: number; adSoyad: string; pozisyon: string | null };
type DevamKaydi = {
  id: number;
  calisanId: number;
  girisSaat: string | null;
  cikisSaat: string | null;
  durum: string;
};
type RaporSatiri = {
  calisanId: number;
  adSoyad: string;
  geldi: number;
  gelmedi: number;
  izinli: number;
};

const durumSecenekleri = [
  { deger: "geldi", etiket: "Geldi", aktif: "bg-emerald-600 border-emerald-600 text-white" },
  { deger: "gelmedi", etiket: "Gelmedi", aktif: "bg-red-600 border-red-600 text-white" },
  { deger: "izinli", etiket: "İzinli", aktif: "bg-amber-500 border-amber-500 text-white" },
];

export default function DevamSayfasi() {
  const [gorunum, setGorunum] = useState<"gunluk" | "rapor">("gunluk");
  const [hata, setHata] = useState("");

  // Günlük görünüm
  const [tarih, setTarih] = useState(bugunStr());
  const [calisanlar, setCalisanlar] = useState<Calisan[]>([]);
  const [kayitlar, setKayitlar] = useState<Record<number, DevamKaydi>>({});
  const [gunlukYukleniyor, setGunlukYukleniyor] = useState(true);

  // Aylık rapor
  const [ay, setAy] = useState(buAyStr());
  const [rapor, setRapor] = useState<RaporSatiri[]>([]);
  const [raporYukleniyor, setRaporYukleniyor] = useState(false);

  const gunlukYukle = useCallback(async () => {
    setHata("");
    setGunlukYukleniyor(true);
    try {
      const [cYanit, dYanit] = await Promise.all([
        fetch("/api/calisanlar?aktif=true"),
        fetch(`/api/devam?tarih=${tarih}`),
      ]);
      if (!cYanit.ok || !dYanit.ok) throw new Error();
      setCalisanlar(await cYanit.json());
      const devamlar: DevamKaydi[] = await dYanit.json();
      setKayitlar(Object.fromEntries(devamlar.map((d) => [d.calisanId, d])));
    } catch {
      setHata("Devam kayıtları yüklenemedi");
    } finally {
      setGunlukYukleniyor(false);
    }
  }, [tarih]);

  const raporYukle = useCallback(async () => {
    setHata("");
    setRaporYukleniyor(true);
    try {
      const yanit = await fetch(`/api/devam/rapor?ay=${ay}`);
      if (!yanit.ok) throw new Error();
      const j = await yanit.json();
      setRapor(j.satirlar);
    } catch {
      setHata("Rapor yüklenemedi");
    } finally {
      setRaporYukleniyor(false);
    }
  }, [ay]);

  useEffect(() => {
    if (gorunum === "gunluk") gunlukYukle();
    else raporYukle();
  }, [gorunum, gunlukYukle, raporYukle]);

  // Durum veya saat değişikliğini kaydeder (aynı güne tek kayıt — upsert)
  async function kaydet(
    calisanId: number,
    degisiklik: Partial<Pick<DevamKaydi, "durum" | "girisSaat" | "cikisSaat">>
  ) {
    const mevcut = kayitlar[calisanId];
    // Saat girildiyse ve durum yoksa "geldi" varsay
    const durum = degisiklik.durum ?? mevcut?.durum ?? "geldi";
    const geldiMi = durum === "geldi";

    const govde = {
      calisanId,
      tarih,
      durum,
      girisSaat: geldiMi ? (degisiklik.girisSaat ?? mevcut?.girisSaat ?? null) : null,
      cikisSaat: geldiMi ? (degisiklik.cikisSaat ?? mevcut?.cikisSaat ?? null) : null,
    };

    const yanit = await fetch("/api/devam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde),
    });
    if (yanit.ok) {
      const kayit = await yanit.json();
      setKayitlar((onceki) => ({ ...onceki, [calisanId]: kayit }));
    } else {
      const j = await yanit.json().catch(() => null);
      setHata(j?.hata ?? "Kayıt başarısız oldu");
    }
  }

  function saatKaydet(calisanId: number, alan: "girisSaat" | "cikisSaat", deger: string) {
    const mevcutDeger = kayitlar[calisanId]?.[alan] ?? "";
    if (deger === mevcutDeger) return;
    kaydet(calisanId, { [alan]: deger || null });
  }

  const ozet = {
    geldi: Object.values(kayitlar).filter((k) => k.durum === "geldi").length,
    gelmedi: Object.values(kayitlar).filter((k) => k.durum === "gelmedi").length,
    izinli: Object.values(kayitlar).filter((k) => k.durum === "izinli").length,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Devam / Puantaj</h1>
          <p className="mt-1 text-sm text-slate-500">
            Günlük giriş-çıkış kaydı ve aylık devamsızlık raporu
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setGorunum("gunluk")}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm transition-colors ${
              gorunum === "gunluk"
                ? "bg-slate-900 font-medium text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <CalendarDays size={15} />
            Günlük Giriş
          </button>
          <button
            onClick={() => setGorunum("rapor")}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm transition-colors ${
              gorunum === "rapor"
                ? "bg-slate-900 font-medium text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <BarChart3 size={15} />
            Aylık Rapor
          </button>
        </div>
      </div>

      {hata && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{hata}</p>
      )}

      {gorunum === "gunluk" ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <input
              type="date"
              value={tarih}
              onChange={(e) => e.target.value && setTarih(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <div className="flex gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                {ozet.geldi} geldi
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                {ozet.gelmedi} gelmedi
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                {ozet.izinli} izinli
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Çalışan</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                  <th className="px-4 py-3 font-medium">Giriş Saati</th>
                  <th className="px-4 py-3 font-medium">Çıkış Saati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gunlukYukleniyor ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : calisanlar.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      Aktif çalışan yok. Önce Çalışanlar ekranından çalışan ekleyin.
                    </td>
                  </tr>
                ) : (
                  calisanlar.map((c) => {
                    const kayit = kayitlar[c.id];
                    const geldiMi = kayit?.durum === "geldi";
                    return (
                      <tr key={`${c.id}-${tarih}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{c.adSoyad}</p>
                          {c.pozisyon && (
                            <p className="text-xs text-slate-400">{c.pozisyon}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {durumSecenekleri.map((d) => (
                              <button
                                key={d.deger}
                                onClick={() => kaydet(c.id, { durum: d.deger })}
                                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                  kayit?.durum === d.deger
                                    ? d.aktif
                                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                                }`}
                              >
                                {d.etiket}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            defaultValue={kayit?.girisSaat ?? ""}
                            disabled={kayit ? !geldiMi : false}
                            onBlur={(e) => saatKaydet(c.id, "girisSaat", e.target.value)}
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            defaultValue={kayit?.cikisSaat ?? ""}
                            disabled={kayit ? !geldiMi : false}
                            onBlur={(e) => saatKaydet(c.id, "cikisSaat", e.target.value)}
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-300"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Durum butonuna tıklayınca kaydedilir; saatler alanından çıkınca otomatik kaydedilir.
          </p>
        </>
      ) : (
        <>
          <div className="mt-5">
            <input
              type="month"
              value={ay}
              onChange={(e) => e.target.value && setAy(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Çalışan</th>
                  <th className="px-4 py-3 text-center font-medium">Geldi</th>
                  <th className="px-4 py-3 text-center font-medium">Gelmedi</th>
                  <th className="px-4 py-3 text-center font-medium">İzinli</th>
                  <th className="px-4 py-3 text-center font-medium">Kayıtlı Gün</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {raporYukleniyor ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : rapor.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Bu ay için kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  rapor.map((s) => (
                    <tr key={s.calisanId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.adSoyad}</td>
                      <td className="px-4 py-3 text-center text-emerald-600">{s.geldi}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={s.gelmedi > 0 ? "font-semibold text-red-600" : ""}>
                          {s.gelmedi}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-amber-600">{s.izinli}</td>
                      <td className="px-4 py-3 text-center text-slate-500">
                        {s.geldi + s.gelmedi + s.izinli}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
