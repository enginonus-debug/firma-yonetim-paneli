"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, CheckCircle2, ClipboardList, Eye, ShieldCheck, XCircle } from "lucide-react";

type Bildirim = {
  id: number;
  tip: string;
  mesaj: string;
  gorevId: number | null;
  okundu: boolean;
  olusturma: string;
};

const tipGorsel: Record<string, { Ikon: typeof Bell; renk: string }> = {
  atama: { Ikon: ClipboardList, renk: "text-sky-600" },
  kontrol_bekliyor: { Ikon: Eye, renk: "text-amber-600" },
  denetim_bekliyor: { Ikon: ShieldCheck, renk: "text-amber-600" },
  tamamlandi: { Ikon: CheckCircle2, renk: "text-emerald-600" },
  reddedildi: { Ikon: XCircle, renk: "text-red-600" },
};

function zamanGoster(t: string) {
  const fark = Date.now() - new Date(t).getTime();
  const dk = Math.round(fark / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  return new Date(t).toLocaleDateString("tr-TR");
}

export default function BildirimKarti() {
  const [veriler, setVeriler] = useState<Bildirim[]>([]);
  const [okunmamis, setOkunmamis] = useState(0);
  const [yuklendi, setYuklendi] = useState(false);

  const yukle = useCallback(async () => {
    try {
      const r = await fetch("/api/bildirimler");
      if (r.ok) {
        const j = await r.json();
        setVeriler(j.veriler);
        setOkunmamis(j.okunmamis);
      }
    } catch {
      /* sessiz */
    } finally {
      setYuklendi(true);
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  async function ac(b: Bildirim) {
    if (!b.okundu) {
      await fetch(`/api/bildirimler/${b.id}`, { method: "PATCH" });
    }
    if (b.gorevId) {
      window.location.href = `/gorevler?gorev=${b.gorevId}`;
    } else {
      yukle();
    }
  }

  async function hepsiniOku() {
    await fetch("/api/bildirimler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hepsi: true }),
    });
    yukle();
  }

  // Bildirim yoksa kartı hiç gösterme (paneli sade tutar)
  if (yuklendi && veriler.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="relative">
            <Bell size={18} className="text-sky-600" />
            {okunmamis > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {okunmamis}
              </span>
            )}
          </span>
          Bildirimler
        </h2>
        {okunmamis > 0 && (
          <button
            onClick={hepsiniOku}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <Check size={13} />
            Tümünü okundu işaretle
          </button>
        )}
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {veriler.map((b) => {
          const g = tipGorsel[b.tip] ?? { Ikon: Bell, renk: "text-slate-500" };
          const Ikon = g.Ikon;
          return (
            <li key={b.id}>
              <button
                onClick={() => ac(b)}
                className={`flex w-full items-start gap-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${
                  b.okundu ? "opacity-60" : ""
                }`}
              >
                <span className="relative mt-0.5 shrink-0">
                  <Ikon size={17} className={g.renk} />
                  {!b.okundu && (
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-sky-500" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block ${b.okundu ? "text-slate-500" : "font-medium text-slate-800"}`}>
                    {b.mesaj}
                  </span>
                  <span className="text-xs text-slate-400">{zamanGoster(b.olusturma)}</span>
                </span>
                {b.gorevId && (
                  <span className="shrink-0 self-center text-xs text-sky-600">Aç →</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
