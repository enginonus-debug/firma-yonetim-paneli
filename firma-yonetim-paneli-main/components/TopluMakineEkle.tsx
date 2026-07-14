"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Trash2, Upload, X } from "lucide-react";

// Toplu (Excel) makine/ekipman içe aktarma. Dosya istemcide ayrıştırılır;
// sunucuya yalnızca temizlenmiş satırlar gönderilir. Kurallar esnektir:
// yalnızca "ad" zorunlu, diğer alanlar boş bırakılabilir.

type Durum = "calisiyor" | "bakimda" | "arizali";
type SatirVeri = {
  ad: string;
  model: string | null;
  seriNo: string | null;
  durum: Durum;
  durumNotu: string | null;
  sorumlu: string | null;
};
type OnizlemeSatiri = { satir: number; veri: SatirVeri; gecerli: boolean };

function normal(s: unknown) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/̇/g, "")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]/g, "");
}
function eslesir(baslikNormal: string, esler: string[]) {
  return esler.some((e) => normal(e) === baslikNormal);
}

const ALAN_ESLEME: { key: Exclude<keyof SatirVeri, "durum">; esler: string[] }[] = [
  { key: "ad", esler: ["makine adı", "makine", "makina", "makina adı", "ad", "adı", "ekipman", "ekipman adı", "cihaz", "cihaz adı", "teçhizat", "name", "isim"] },
  { key: "model", esler: ["model", "marka", "marka model", "marka/model", "model/marka"] },
  { key: "seriNo", esler: ["seri no", "seri numarası", "serino", "seri", "serial", "serial no", "seri̇ no", "seri num"] },
  { key: "durumNotu", esler: ["durum notu", "not", "açıklama", "bakım notu", "arıza notu", "durum açıklaması", "arıza", "bakım", "aciklama"] },
  { key: "sorumlu", esler: ["sorumlu", "sorumlu kişi", "sorumlusu", "sorumlu personel", "operatör", "operator", "ilgili", "ilgili kişi"] },
];
const DURUM_ESLER = ["durum", "statü", "status", "çalışma durumu", "makine durumu", "makina durumu", "durumu"];

function metinCoz(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function durumCoz(v: unknown): Durum {
  const n = normal(v);
  if (!n) return "calisiyor";
  if (["bakimda", "bakim", "maintenance", "serviste", "servis"].includes(n)) return "bakimda";
  if (["arizali", "ariza", "bozuk", "broken", "faulty", "hasarli"].includes(n)) return "arizali";
  // çalışıyor / aktif / faal / normal / ok → calisiyor (varsayılan)
  return "calisiyor";
}

const DURUM_ETIKET: Record<Durum, string> = {
  calisiyor: "Çalışıyor",
  bakimda: "Bakımda",
  arizali: "Arızalı",
};

export default function TopluMakineEkle({
  kapat,
  tamam,
}: {
  kapat: () => void;
  tamam: (eklenen: number) => void;
}) {
  const [satirlar, setSatirlar] = useState<OnizlemeSatiri[]>([]);
  const [dosyaAd, setDosyaAd] = useState("");
  const [hata, setHata] = useState("");
  const [surukleniyor, setSurukleniyor] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const dosyaGirdi = useRef<HTMLInputElement>(null);

  function dosyaIsle(dosya: File) {
    setHata("");
    const ad = dosya.name.toLowerCase();
    if (!/\.(xlsx|xls|csv)$/.test(ad)) {
      setHata("Yalnızca Excel (.xlsx, .xls) veya .csv dosyası yükleyin");
      return;
    }
    const csvMi = ad.endsWith(".csv");
    const okuyucu = new FileReader();
    okuyucu.onload = (e) => {
      try {
        const kitap = csvMi
          ? XLSX.read(e.target?.result, { type: "string" })
          : XLSX.read(e.target?.result, { type: "array" });
        const sayfa = kitap.Sheets[kitap.SheetNames[0]];
        const matris = XLSX.utils.sheet_to_json<unknown[]>(sayfa, {
          header: 1,
          blankrows: false,
          defval: null,
        });
        if (matris.length < 2) {
          setHata("Dosyada başlık satırı ve en az bir veri satırı olmalı");
          return;
        }
        const basliklar = (matris[0] as unknown[]).map((h) => normal(h));
        const indeks: Partial<Record<keyof SatirVeri, number>> = {};
        for (const { key, esler } of ALAN_ESLEME) {
          const i = basliklar.findIndex((b) => b && eslesir(b, esler));
          if (i >= 0) indeks[key] = i;
        }
        const durumI = basliklar.findIndex((b) => b && eslesir(b, DURUM_ESLER));
        if (durumI >= 0) indeks.durum = durumI;

        if (indeks.ad === undefined) {
          setHata(
            "'Makine Adı' sütunu bulunamadı. Başlıkta Makine Adı, Model, Seri No, Durum gibi sütunlar olmalı."
          );
          return;
        }

        const al = (satir: unknown[], key: keyof SatirVeri) => {
          const i = indeks[key];
          return i === undefined ? null : satir[i];
        };

        const cozulen: OnizlemeSatiri[] = [];
        for (let r = 1; r < matris.length; r++) {
          const satir = matris[r] as unknown[];
          const ad = metinCoz(al(satir, "ad"));
          const veri: SatirVeri = {
            ad: ad ?? "",
            model: metinCoz(al(satir, "model")),
            seriNo: metinCoz(al(satir, "seriNo")),
            durum: durumCoz(al(satir, "durum")),
            durumNotu: metinCoz(al(satir, "durumNotu")),
            sorumlu: metinCoz(al(satir, "sorumlu")),
          };
          const bosSatir =
            !ad && !veri.model && !veri.seriNo && !veri.durumNotu && !veri.sorumlu;
          if (bosSatir) continue;
          cozulen.push({ satir: r + 1, veri, gecerli: !!ad });
        }

        if (cozulen.length === 0) {
          setHata("Dosyada içe aktarılacak veri satırı bulunamadı");
          return;
        }
        setDosyaAd(dosya.name);
        setSatirlar(cozulen);
      } catch {
        setHata("Dosya okunamadı. Geçerli bir Excel/CSV dosyası olduğundan emin olun.");
      }
    };
    okuyucu.onerror = () => setHata("Dosya okunamadı");
    if (csvMi) okuyucu.readAsText(dosya, "UTF-8");
    else okuyucu.readAsArrayBuffer(dosya);
  }

  async function ekle() {
    const gecerliler = satirlar
      .filter((s) => s.gecerli)
      .map((s) => ({
        ad: s.veri.ad.trim(),
        model: s.veri.model || null,
        seriNo: s.veri.seriNo || null,
        durum: s.veri.durum,
        durumNotu: s.veri.durumNotu || null,
        sorumlu: s.veri.sorumlu || null,
      }));
    if (gecerliler.length === 0) return;
    setGonderiliyor(true);
    setHata("");
    try {
      const yanit = await fetch("/api/makineler/toplu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ makineler: gecerliler }),
      });
      if (!yanit.ok) {
        setHata((await yanit.json().catch(() => null))?.hata ?? "İçe aktarma başarısız oldu");
        return;
      }
      const j = await yanit.json();
      tamam(j.eklenen ?? gecerliler.length);
    } catch {
      setHata("Sunucuya ulaşılamadı");
    } finally {
      setGonderiliyor(false);
    }
  }

  function sablonIndir() {
    const basliklar = ["Makine Adı", "Model", "Seri No", "Durum", "Durum Notu", "Sorumlu"];
    const ornek = ["CNC Freze", "Biesse Rover A", "CNC-2021-001", "Çalışıyor", "", "Ahmet Yılmaz"];
    const ws = XLSX.utils.aoa_to_sheet([basliklar, ornek]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Makineler");
    XLSX.writeFile(wb, "makine-sablonu.xlsx");
  }

  const gecerliSayi = satirlar.filter((s) => s.gecerli).length;
  const sorunluSayi = satirlar.length - gecerliSayi;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Excel'den Toplu Makine Ekle</h2>
          <button
            onClick={kapat}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {satirlar.length === 0 ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setSurukleniyor(true);
              }}
              onDragLeave={() => setSurukleniyor(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSurukleniyor(false);
                const dosya = e.dataTransfer.files?.[0];
                if (dosya) dosyaIsle(dosya);
              }}
              onClick={() => dosyaGirdi.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                surukleniyor ? "border-sky-500 bg-sky-50" : "border-slate-300 hover:border-sky-400 hover:bg-slate-50"
              }`}
            >
              <Upload size={32} className="text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Excel dosyasını buraya sürükleyip bırakın
              </p>
              <p className="mt-1 text-xs text-slate-400">veya tıklayıp seçin · .xlsx, .xls, .csv</p>
              <input
                ref={dosyaGirdi}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const dosya = e.target.files?.[0];
                  e.target.value = "";
                  if (dosya) dosyaIsle(dosya);
                }}
              />
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <p className="font-medium text-slate-600">Nasıl çalışır?</p>
              <p className="mt-1">
                İlk satır başlık olmalı. Tanınan sütunlar: Makine Adı (zorunlu), Model, Seri No,
                Durum (Çalışıyor/Bakımda/Arızalı), Durum Notu, Sorumlu. Listede olmayan sütunlar boş
                bırakılır; Sorumlu adı aktif çalışanlarla eşleştirilir.
              </p>
              <button
                onClick={sablonIndir}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
              >
                <Download size={14} />
                Örnek şablonu indir
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span className="font-medium text-slate-800">{dosyaAd}</span>
                <span className="text-slate-400">·</span>
                <span className="text-emerald-600">{gecerliSayi} geçerli</span>
                {sorunluSayi > 0 && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="text-red-500">{sorunluSayi} atlanacak</span>
                  </>
                )}
              </p>
              <button
                onClick={() => {
                  setSatirlar([]);
                  setDosyaAd("");
                }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Trash2 size={13} />
                Farklı dosya
              </button>
            </div>

            <div className="max-h-[45vh] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Makine Adı</th>
                    <th className="px-2 py-2 font-medium">Model</th>
                    <th className="px-2 py-2 font-medium">Seri No</th>
                    <th className="px-2 py-2 font-medium">Durum</th>
                    <th className="px-2 py-2 font-medium">Sorumlu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {satirlar.map((s, i) => (
                    <tr key={i} className={s.gecerli ? "" : "bg-red-50 text-slate-400"}>
                      <td className="px-2 py-1.5 text-slate-400">{s.satir}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">
                        {s.gecerli ? s.veri.ad : <span className="text-red-500">Ad boş</span>}
                      </td>
                      <td className="px-2 py-1.5">{s.veri.model ?? "—"}</td>
                      <td className="px-2 py-1.5">{s.veri.seriNo ?? "—"}</td>
                      <td className="px-2 py-1.5">{DURUM_ETIKET[s.veri.durum]}</td>
                      <td className="px-2 py-1.5">{s.veri.sorumlu ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sorunluSayi > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Adı boş olan {sorunluSayi} satır atlanacak. Diğer eksik bilgiler boş eklenir.
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={kapat}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                onClick={ekle}
                disabled={gonderiliyor || gecerliSayi === 0}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
              >
                {gonderiliyor ? "Ekleniyor…" : `${gecerliSayi} Makineyi Ekle`}
              </button>
            </div>
          </>
        )}

        {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}
      </div>
    </div>
  );
}
