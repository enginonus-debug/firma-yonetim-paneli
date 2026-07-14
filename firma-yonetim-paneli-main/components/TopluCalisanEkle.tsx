"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Trash2, Upload, X } from "lucide-react";

// Toplu (Excel) çalışan içe aktarma. Dosya istemcide ayrıştırılır; sunucuya
// yalnızca ayrıştırılmış/temizlenmiş satırlar gönderilir (ham dosya gitmez).

type SatirVeri = {
  adSoyad: string;
  tcKimlikNo: string | null;
  dogumTarihi: string | null;
  cinsiyet: "erkek" | "kadin" | null;
  pozisyon: string | null;
  telefon: string | null;
  il: string | null;
  ilce: string | null;
  adres: string | null;
  acilTelefon: string | null;
  iseBaslama: string | null;
  maas: number | null;
  engelli: boolean;
  engelDurumu: string | null;
};

type OnizlemeSatiri = { satir: number; veri: SatirVeri; gecerli: boolean; sorun: string | null };

// Excel başlıklarını iç alan adlarına eşlemek için normalleştirme.
// Türkçe harfleri ASCII'ye katlar (ı/İ→i, ç→c, ğ→g, ö→o, ş→s, ü→u) ve harf
// dışı her şeyi atar. Böylece "Adı Soyadı", "Adi Soyadi", "AD SOYAD" hepsi aynı
// anahtara ("adsoyadi") iner ve diakritik/boşluk/büyük-küçük farkı önemsizleşir.
function normal(s: unknown) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/̇/g, "") // "İ".toLowerCase() sonrası kalan birleşik nokta
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

// Bir başlığın, verilen eş anlamlılardan biriyle (normalleştirilerek) eşleşip
// eşleşmediğini kontrol eder.
function eslesir(baslikNormal: string, esler: string[]) {
  return esler.some((e) => normal(e) === baslikNormal);
}

// Ad-soyad tek sütunda olabilir ya da ayrı "Ad" + "Soyad" sütunları olabilir.
const ISIM_BIRLESIK = [
  "ad soyad", "adı soyadı", "adi soyadi", "ad-soyad", "ad soyisim", "ad ve soyad",
  "isim", "isim soyisim", "isim soyad", "isimsoyisim", "adsoyad", "adisoyadi",
  "personel", "personel adı", "personel adi", "personel ad soyad", "çalışan",
  "çalışan adı", "calisan", "calisan adi", "adı-soyadı", "ad/soyad", "fullname", "full name",
];
const ISIM_AD = ["ad", "adı", "adi", "ön ad", "önad", "first name", "firstname", "isim (ad)"];
const ISIM_SOYAD = ["soyad", "soyadı", "soyadi", "soyisim", "surname", "last name", "lastname"];

const ALAN_ESLEME: { key: Exclude<keyof SatirVeri, "adSoyad">; esler: string[] }[] = [
  { key: "tcKimlikNo", esler: ["tc", "tc no", "tckn", "tc kimlik", "tc kimlik no", "tc kimlik numarası", "kimlik", "kimlik no", "kimlik numarası", "vatandaşlık no", "t.c."] },
  { key: "dogumTarihi", esler: ["doğum tarihi", "doğum günü", "doğum", "doğ tarihi", "dogum tarihi", "dogum gunu", "birth", "birthday", "doğum trh"] },
  { key: "cinsiyet", esler: ["cinsiyet", "cins", "gender"] },
  { key: "pozisyon", esler: ["pozisyon", "görev", "görevi", "unvan", "ünvan", "departman", "bölüm", "birim", "meslek", "title", "position"] },
  { key: "telefon", esler: ["telefon", "tel", "gsm", "cep", "cep telefonu", "cep no", "telefon no", "tel no", "telefon numarası", "iletişim", "iletişim no", "phone"] },
  { key: "il", esler: ["il", "şehir", "il / şehir", "city"] },
  { key: "ilce", esler: ["ilçe", "semt", "district"] },
  { key: "adres", esler: ["adres", "açık adres", "ikamet", "ikamet bilgisi", "ikametgah", "adres bilgisi", "ev adresi", "address"] },
  { key: "acilTelefon", esler: ["acil", "acil telefon", "acil tel", "acil no", "acil durum", "acil durumda aranacak", "acil irtibat", "yakını", "yakın", "yakın telefonu", "emergency"] },
  { key: "iseBaslama", esler: ["işe başlama", "işe başlama tarihi", "işe giriş", "işe giriş tarihi", "giriş tarihi", "başlama tarihi", "işe başlangıç", "işe başlangıç tarihi", "giriş", "başlama", "işbaşı", "işe alım", "işe alım tarihi", "start date"] },
  { key: "maas", esler: ["maaş", "ücret", "brüt maaş", "net maaş", "aylık", "aylık ücret", "brüt", "net", "salary"] },
  { key: "engelli", esler: ["engelli", "engelli mi", "engel var mı", "engel"] },
  { key: "engelDurumu", esler: ["engel durumu", "engel açıklama", "engel bilgisi", "engel detayı", "engel durum"] },
];

function iki(n: number | string) {
  return String(n).padStart(2, "0");
}

// Çeşitli biçimlerdeki tarihi "YYYY-MM-DD"ye çevirir; çözülemezse null
function tarihCoz(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${iki(v.getMonth() + 1)}-${iki(v.getDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/); // gg.aa.yyyy
  if (m) {
    const yil = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${yil}-${iki(m[2])}-${iki(m[1])}`;
  }
  m = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/); // yyyy-aa-gg
  if (m) return `${m[1]}-${iki(m[2])}-${iki(m[3])}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
  return null;
}

function cinsiyetCoz(v: unknown): "erkek" | "kadin" | null {
  const n = normal(String(v ?? ""));
  if (!n) return null;
  if (["erkek", "e", "bay", "male", "m", "bay"].includes(n)) return "erkek";
  if (["kadin", "kadın", "k", "bayan", "female", "f"].includes(n)) return "kadin";
  return null;
}

function evetMi(v: unknown): boolean {
  const n = normal(String(v ?? ""));
  return ["evet", "var", "x", "true", "1", "e", "eh"].includes(n);
}

// Telefonu yalnızca rakama indirir, başındaki 0'ları atar, en fazla 10 hane
function telefonCoz(v: unknown): string | null {
  if (v == null || v === "") return null;
  const r = String(v).replace(/\D/g, "").replace(/^0+/, "");
  return r ? r.slice(0, 10) : null;
}

function metinCoz(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function maasCoz(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v >= 0 ? v : null;
  const s = String(v).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function TopluCalisanEkle({
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
        // CSV UTF-8 metin olarak okunur (Türkçe karakterler korunur); Excel
        // dosyaları ikili (array) olarak okunur.
        const kitap = csvMi
          ? XLSX.read(e.target?.result, { type: "string", cellDates: true })
          : XLSX.read(e.target?.result, { type: "array", cellDates: true });
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
        // Diğer alanlar için sütun indeksini bul (diakritik-duyarsız eşleşme)
        const indeks: Partial<Record<keyof SatirVeri, number>> = {};
        for (const { key, esler } of ALAN_ESLEME) {
          const i = basliklar.findIndex((b) => b && eslesir(b, esler));
          if (i >= 0) indeks[key] = i;
        }
        // Ad-soyad: birleşik sütun ya da ayrı "Ad" + "Soyad" sütunları
        const birlesikI = basliklar.findIndex((b) => b && eslesir(b, ISIM_BIRLESIK));
        const adI = basliklar.findIndex((b) => b && eslesir(b, ISIM_AD));
        const soyadI = basliklar.findIndex((b) => b && eslesir(b, ISIM_SOYAD));
        if (birlesikI < 0 && adI < 0) {
          setHata(
            "Ad-soyad sütunu bulunamadı. Başlıkta 'Ad Soyad', 'Adı Soyadı', 'İsim' ya da ayrı 'Ad' + 'Soyad' sütunları olmalı."
          );
          return;
        }

        const al = (satir: unknown[], key: keyof SatirVeri) => {
          const i = indeks[key];
          return i === undefined ? null : satir[i];
        };
        // Satırdan ad-soyadı çözer: birleşik varsa onu, yoksa ad + soyad birleşimi
        const adSoyadCoz = (satir: unknown[]) => {
          if (birlesikI >= 0) return metinCoz(satir[birlesikI]);
          const ad = adI >= 0 ? metinCoz(satir[adI]) : null;
          const soyad = soyadI >= 0 ? metinCoz(satir[soyadI]) : null;
          const tam = [ad, soyad].filter(Boolean).join(" ").trim();
          return tam || null;
        };

        const cozulen: OnizlemeSatiri[] = [];
        for (let r = 1; r < matris.length; r++) {
          const satir = matris[r] as unknown[];
          const adSoyad = adSoyadCoz(satir);
          const veri: SatirVeri = {
            adSoyad: adSoyad ?? "",
            tcKimlikNo: metinCoz(al(satir, "tcKimlikNo")),
            dogumTarihi: tarihCoz(al(satir, "dogumTarihi")),
            cinsiyet: cinsiyetCoz(al(satir, "cinsiyet")),
            pozisyon: metinCoz(al(satir, "pozisyon")),
            telefon: telefonCoz(al(satir, "telefon")),
            il: metinCoz(al(satir, "il")),
            ilce: metinCoz(al(satir, "ilce")),
            adres: metinCoz(al(satir, "adres")),
            acilTelefon: telefonCoz(al(satir, "acilTelefon")),
            iseBaslama: tarihCoz(al(satir, "iseBaslama")),
            maas: maasCoz(al(satir, "maas")),
            engelli: indeks.engelli !== undefined ? evetMi(al(satir, "engelli")) : false,
            engelDurumu: metinCoz(al(satir, "engelDurumu")),
          };
          const bosSatir = !adSoyad && Object.values(veri).every((x) => x === null || x === false || x === "");
          if (bosSatir) continue; // tamamen boş satırı atla
          const gecerli = !!adSoyad;
          cozulen.push({
            satir: r + 1,
            veri,
            gecerli,
            sorun: gecerli ? null : "Ad soyad boş",
          });
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
    const gecerliler = satirlar.filter((s) => s.gecerli).map((s) => temizle(s.veri));
    if (gecerliler.length === 0) return;
    setGonderiliyor(true);
    setHata("");
    try {
      const yanit = await fetch("/api/calisanlar/toplu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calisanlar: gecerliler }),
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
    const basliklar = [
      "Ad Soyad", "TC Kimlik No", "Doğum Tarihi", "Cinsiyet", "Pozisyon",
      "Telefon", "İl", "İlçe", "Adres", "Acil Telefon", "İşe Başlama", "Maaş",
      "Engelli", "Engel Durumu",
    ];
    const ornek = [
      "Ahmet Yılmaz", "12345678901", "01.05.1990", "Erkek", "Usta",
      "5321234567", "Ankara", "Çankaya", "Örnek Mah. 1. Sok. No:2", "5329876543",
      "01.03.2022", "35000", "Hayır", "",
    ];
    const ws = XLSX.utils.aoa_to_sheet([basliklar, ornek]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Çalışanlar");
    XLSX.writeFile(wb, "calisan-sablonu.xlsx");
  }

  const gecerliSayi = satirlar.filter((s) => s.gecerli).length;
  const sorunluSayi = satirlar.length - gecerliSayi;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Excel'den Toplu Çalışan Ekle</h2>
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
                surukleniyor
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-300 hover:border-sky-400 hover:bg-slate-50"
              }`}
            >
              <Upload size={32} className="text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Excel dosyasını buraya sürükleyip bırakın
              </p>
              <p className="mt-1 text-xs text-slate-400">
                veya tıklayıp seçin · .xlsx, .xls, .csv
              </p>
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
                İlk satır başlık olmalı. Tanınan sütunlar: Ad Soyad (zorunlu), TC Kimlik No,
                Doğum Tarihi, Cinsiyet, Pozisyon, Telefon, İl, İlçe, Adres, Acil Telefon, İşe
                Başlama, Maaş, Engelli. Listede olmayan sütunlar boş bırakılır.
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
                    <th className="px-2 py-2 font-medium">Ad Soyad</th>
                    <th className="px-2 py-2 font-medium">TC</th>
                    <th className="px-2 py-2 font-medium">Doğum</th>
                    <th className="px-2 py-2 font-medium">Cins.</th>
                    <th className="px-2 py-2 font-medium">Pozisyon</th>
                    <th className="px-2 py-2 font-medium">Telefon</th>
                    <th className="px-2 py-2 font-medium">İl/İlçe</th>
                    <th className="px-2 py-2 font-medium">İşe Baş.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {satirlar.map((s, i) => (
                    <tr key={i} className={s.gecerli ? "" : "bg-red-50 text-slate-400"}>
                      <td className="px-2 py-1.5 text-slate-400">{s.satir}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">
                        {s.gecerli ? s.veri.adSoyad : <span className="text-red-500">{s.sorun}</span>}
                      </td>
                      <td className="px-2 py-1.5">{s.veri.tcKimlikNo ?? "—"}</td>
                      <td className="px-2 py-1.5">{s.veri.dogumTarihi ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {s.veri.cinsiyet === "erkek" ? "E" : s.veri.cinsiyet === "kadin" ? "K" : "—"}
                      </td>
                      <td className="px-2 py-1.5">{s.veri.pozisyon ?? "—"}</td>
                      <td className="px-2 py-1.5">{s.veri.telefon ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {s.veri.il ? `${s.veri.il}${s.veri.ilce ? "/" + s.veri.ilce : ""}` : "—"}
                      </td>
                      <td className="px-2 py-1.5">{s.veri.iseBaslama ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sorunluSayi > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Ad soyadı boş olan {sorunluSayi} satır atlanacak. Diğer eksik bilgiler boş
                eklenir; sonradan düzenleyebilirsiniz.
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
                {gonderiliyor ? "Ekleniyor…" : `${gecerliSayi} Çalışanı Ekle`}
              </button>
            </div>
          </>
        )}

        {hata && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>
        )}
      </div>
    </div>
  );
}

// Boş metinleri null'a çevirir; gönderilecek temiz nesneyi üretir
function temizle(v: SatirVeri) {
  return {
    adSoyad: v.adSoyad.trim(),
    tcKimlikNo: v.tcKimlikNo || null,
    dogumTarihi: v.dogumTarihi || null,
    cinsiyet: v.cinsiyet || null,
    pozisyon: v.pozisyon || null,
    telefon: v.telefon || null,
    il: v.il || null,
    ilce: v.ilce || null,
    adres: v.adres || null,
    acilTelefon: v.acilTelefon || null,
    iseBaslama: v.iseBaslama || null,
    maas: v.maas,
    engelli: v.engelli,
    engelDurumu: v.engelDurumu || null,
  };
}
