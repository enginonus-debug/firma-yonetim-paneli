"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";

type Not = { id: number; tarih: string; metin: string };

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const GUN_ADLARI = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

function gunStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function ayStr(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export default function TakvimKarti() {
  const bugun = new Date();
  const bugunStr = gunStr(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
  const buAy = ayStr(bugun.getFullYear(), bugun.getMonth());

  const [saat, setSaat] = useState<Date>(bugun);
  const [acik, setAcik] = useState(false); // takvim varsayılan kapalı (minimal)
  const [yil, setYil] = useState(bugun.getFullYear());
  const [ay, setAy] = useState(bugun.getMonth());
  const [notlar, setNotlar] = useState<Not[]>([]); // görüntülenen ayın notları
  const [bugunNotlari, setBugunNotlari] = useState<Not[]>([]); // her zaman bugüne ait
  const [seciliGun, setSeciliGun] = useState<string>(bugunStr);
  const [yeniNot, setYeniNot] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState("");

  // Canlı saat
  useEffect(() => {
    const t = setInterval(() => setSaat(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Bugünün notları, görüntülenen aydan bağımsız olarak ayrı yüklenir
  const bugunNotlariYukle = useCallback(async () => {
    try {
      const r = await fetch(`/api/takvim?ay=${buAy}`);
      if (r.ok) {
        const j: Not[] = await r.json();
        setBugunNotlari(j.filter((n) => n.tarih.slice(0, 10) === bugunStr));
      }
    } catch {
      /* sessiz geç */
    }
  }, [buAy, bugunStr]);

  const notlariYukle = useCallback(async () => {
    setHata("");
    try {
      const r = await fetch(`/api/takvim?ay=${ayStr(yil, ay)}`);
      if (!r.ok) throw new Error();
      setNotlar(await r.json());
    } catch {
      setHata("Notlar yüklenemedi");
    }
  }, [yil, ay]);

  useEffect(() => {
    bugunNotlariYukle();
  }, [bugunNotlariYukle]);

  // Takvim yalnızca açıkken (görüntülenen ay için) yüklenir
  useEffect(() => {
    if (acik) notlariYukle();
  }, [acik, notlariYukle]);

  const gunNotlari = (g: string) => notlar.filter((n) => n.tarih.slice(0, 10) === g);
  const notluGunler = new Set(notlar.map((n) => n.tarih.slice(0, 10)));

  function oncekiAy() {
    if (ay === 0) { setYil(yil - 1); setAy(11); } else setAy(ay - 1);
  }
  function sonrakiAy() {
    if (ay === 11) { setYil(yil + 1); setAy(0); } else setAy(ay + 1);
  }

  async function tazele() {
    await Promise.all([bugunNotlariYukle(), acik ? notlariYukle() : Promise.resolve()]);
  }

  async function notEkle(e: React.FormEvent) {
    e.preventDefault();
    if (!yeniNot.trim()) return;
    setKaydediliyor(true);
    setHata("");
    try {
      const r = await fetch("/api/takvim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarih: seciliGun, metin: yeniNot.trim() }),
      });
      if (!r.ok) {
        setHata((await r.json().catch(() => null))?.hata ?? "Not eklenemedi");
        return;
      }
      setYeniNot("");
      tazele();
    } catch {
      setHata("Sunucuya ulaşılamadı");
    } finally {
      setKaydediliyor(false);
    }
  }

  async function notSil(id: number) {
    const r = await fetch(`/api/takvim/${id}`, { method: "DELETE" });
    if (r.ok) tazele();
    else setHata("Not silinemedi");
  }

  // Ay ızgarası (Pazartesi ilk gün)
  const ilkGun = new Date(yil, ay, 1);
  const gunSayisi = new Date(yil, ay + 1, 0).getDate();
  const bosluk = (ilkGun.getDay() + 6) % 7;
  const hucreler: (number | null)[] = [
    ...Array(bosluk).fill(null),
    ...Array.from({ length: gunSayisi }, (_, i) => i + 1),
  ];

  const seciliNotlar = gunNotlari(seciliGun);
  const seciliGunGoster = new Date(seciliGun + "T00:00:00").toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", weekday: "long",
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {/* Üst şerit: saat + tarih + bugünün notu + takvim aç/kapat */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-baseline gap-2">
          <Clock size={15} className="translate-y-0.5 text-sky-600" />
          <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">
            {saat.toLocaleTimeString("tr-TR")}
          </span>
          <span className="text-xs text-slate-500">
            {saat.toLocaleDateString("tr-TR", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </span>
        </div>

        {/* Bugünün notları — kompakt, satır içi */}
        <div className="min-w-0 flex-1 text-xs">
          {bugunNotlari.length === 0 ? (
            <span className="text-slate-400">Bugün için not yok</span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {bugunNotlari.map((n) => (
                <span
                  key={n.id}
                  className="group inline-flex max-w-full items-center gap-1 rounded-full bg-sky-50 py-0.5 pl-2 pr-1 text-sky-700"
                >
                  <span className="truncate">{n.metin}</span>
                  <button
                    onClick={() => notSil(n.id)}
                    title="Sil"
                    className="shrink-0 rounded-full p-0.5 text-sky-400 hover:bg-white hover:text-red-600"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </span>
          )}
        </div>

        <button
          onClick={() => setAcik((a) => !a)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <CalendarDays size={14} className="text-sky-600" />
          Takvim
          <ChevronDown
            size={13}
            className={`transition-transform ${acik ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Açılır takvim */}
      {acik && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="sm:w-[15rem] sm:shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {AY_ADLARI[ay]} {yil}
                </span>
                <div className="flex gap-0.5">
                  <button onClick={oncekiAy} title="Önceki ay" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <ChevronLeft size={15} />
                  </button>
                  <button onClick={sonrakiAy} title="Sonraki ay" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-1.5 grid grid-cols-7 gap-0.5 text-center">
                {GUN_ADLARI.map((g) => (
                  <div key={g} className="text-[10px] font-medium text-slate-400">{g}</div>
                ))}
                {hucreler.map((d, i) => {
                  if (d === null) return <div key={`b${i}`} />;
                  const gStr = gunStr(yil, ay, d);
                  const buGun = gStr === bugunStr;
                  const secili = gStr === seciliGun;
                  const notVar = notluGunler.has(gStr);
                  return (
                    <button
                      key={gStr}
                      onClick={() => setSeciliGun(gStr)}
                      className={`relative flex h-7 items-center justify-center rounded-md text-xs transition-colors ${
                        secili
                          ? "bg-sky-600 font-semibold text-white"
                          : buGun
                            ? "bg-sky-100 font-semibold text-sky-700"
                            : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {d}
                      {notVar && (
                        <span
                          className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                            secili ? "bg-white" : "bg-amber-500"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seçili günün notları + ekleme */}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-slate-500">{seciliGunGoster}</p>
              {seciliNotlar.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {seciliNotlar.map((n) => (
                    <li
                      key={n.id}
                      className="group flex items-start justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700"
                    >
                      <span className="min-w-0 flex-1">{n.metin}</span>
                      <button
                        onClick={() => notSil(n.id)}
                        title="Sil"
                        className="shrink-0 rounded p-0.5 text-slate-300 hover:text-red-600 group-hover:text-slate-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={notEkle} className="mt-1.5 flex gap-1.5">
                <input
                  value={yeniNot}
                  onChange={(e) => setYeniNot(e.target.value)}
                  placeholder="Bu güne not ekle…"
                  maxLength={500}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="submit"
                  disabled={kaydediliyor || !yeniNot.trim()}
                  title="Not ekle"
                  className="flex shrink-0 items-center justify-center rounded-lg bg-sky-600 px-2 py-1 text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <Plus size={15} />
                </button>
              </form>
              {hata && <p className="mt-1.5 text-xs text-red-600">{hata}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
