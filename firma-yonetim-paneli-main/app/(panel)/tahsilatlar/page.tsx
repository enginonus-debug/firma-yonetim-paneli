"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import Sayfalama from "@/components/Sayfalama";
import { bugunStr, etiketSinifi, girdiSinifi, para, tarihGoster } from "@/lib/format";

type Tahsilat = {
  id: number;
  tutar: string;
  vadeTarihi: string | null;
  odemeTarihi: string | null;
  durum: string;
  odemeYontemi: string | null;
  musteriId: number;
  satisFirsatiId: number | null;
  musteri: { id: number; ad: string };
  satisFirsati: { id: number; baslik: string | null } | null;
};

type FormVerisi = {
  musteriId: string;
  satisFirsatiId: string;
  tutar: string;
  vadeTarihi: string;
  odemeTarihi: string;
  durum: string;
  odemeYontemi: string;
};

const bosForm: FormVerisi = {
  musteriId: "",
  satisFirsatiId: "",
  tutar: "",
  vadeTarihi: "",
  odemeTarihi: "",
  durum: "bekliyor",
  odemeYontemi: "",
};

const durumlar = [
  { deger: "bekliyor", etiket: "Bekliyor", sinif: "bg-amber-100 text-amber-700" },
  { deger: "gecikti", etiket: "Gecikti", sinif: "bg-red-100 text-red-700" },
  { deger: "tahsil_edildi", etiket: "Tahsil Edildi", sinif: "bg-emerald-100 text-emerald-700" },
];

const odemeYontemleri = [
  { deger: "nakit", etiket: "Nakit" },
  { deger: "havale", etiket: "Havale / EFT" },
  { deger: "cek", etiket: "Çek" },
  { deger: "kredi_karti", etiket: "Kredi Kartı" },
];

const LIMIT = 20;

export default function TahsilatlarSayfasi() {
  const [tahsilatlar, setTahsilatlar] = useState<Tahsilat[]>([]);
  const [filtre, setFiltre] = useState("");
  const [sayfa, setSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  const [form, setForm] = useState<FormVerisi | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<Tahsilat | null>(null);
  const [formHata, setFormHata] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // Modal seçenekleri
  const [musteriler, setMusteriler] = useState<{ id: number; ad: string }[]>([]);
  const [firsatlar, setFirsatlar] = useState<
    { id: number; baslik: string | null; musteriId: number }[]
  >([]);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata("");
    try {
      const p = new URLSearchParams({ sayfa: String(sayfa), limit: String(LIMIT) });
      if (filtre) p.set("durum", filtre);
      const yanit = await fetch(`/api/tahsilatlar?${p}`);
      if (!yanit.ok) throw new Error();
      const j = await yanit.json();
      setTahsilatlar(j.veriler);
      setToplam(j.toplam);
    } catch {
      setHata("Tahsilatlar yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, [sayfa, filtre]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  async function secenekleriYukle() {
    if (musteriler.length === 0) {
      const yanit = await fetch("/api/musteriler?limit=100");
      if (yanit.ok) {
        const j = await yanit.json();
        setMusteriler(j.veriler.map((m: { id: number; ad: string }) => ({ id: m.id, ad: m.ad })));
      }
    }
    if (firsatlar.length === 0) {
      const yanit = await fetch("/api/satis-firsatlari?limit=100");
      if (yanit.ok) {
        const j = await yanit.json();
        setFirsatlar(
          j.veriler.map((f: { id: number; baslik: string | null; musteriId: number }) => ({
            id: f.id,
            baslik: f.baslik,
            musteriId: f.musteriId,
          }))
        );
      }
    }
  }

  function ac(t?: Tahsilat) {
    secenekleriYukle();
    setDuzenlenen(t ?? null);
    setForm(
      t
        ? {
            musteriId: String(t.musteriId),
            satisFirsatiId: t.satisFirsatiId ? String(t.satisFirsatiId) : "",
            tutar: String(Number(t.tutar)),
            vadeTarihi: t.vadeTarihi?.slice(0, 10) ?? "",
            odemeTarihi: t.odemeTarihi?.slice(0, 10) ?? "",
            durum: t.durum,
            odemeYontemi: t.odemeYontemi ?? "",
          }
        : bosForm
    );
    setFormHata("");
  }

  function kapat() {
    setForm(null);
    setDuzenlenen(null);
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setKaydediliyor(true);
    setFormHata("");

    const govde = {
      musteriId: Number(form.musteriId),
      satisFirsatiId: form.satisFirsatiId ? Number(form.satisFirsatiId) : null,
      tutar: Number(form.tutar),
      vadeTarihi: form.vadeTarihi || null,
      odemeTarihi:
        form.durum === "tahsil_edildi" ? form.odemeTarihi || bugunStr() : null,
      durum: form.durum,
      odemeYontemi: form.odemeYontemi || null,
    };

    try {
      const yanit = await fetch(
        duzenlenen ? `/api/tahsilatlar/${duzenlenen.id}` : "/api/tahsilatlar",
        {
          method: duzenlenen ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(govde),
        }
      );
      if (!yanit.ok) {
        const j = await yanit.json().catch(() => null);
        setFormHata(j?.hata ?? "Kayıt başarısız oldu");
        return;
      }
      kapat();
      yukle();
    } catch {
      setFormHata("Sunucuya ulaşılamadı");
    } finally {
      setKaydediliyor(false);
    }
  }

  // Tek tıkla tahsil et (ödeme tarihi otomatik bugün olur)
  async function tahsilEt(t: Tahsilat) {
    const yanit = await fetch(`/api/tahsilatlar/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum: "tahsil_edildi" }),
    });
    if (yanit.ok) yukle();
    else setHata("İşlem başarısız oldu");
  }

  async function sil(t: Tahsilat) {
    if (!window.confirm(`${t.musteri.ad} — ${para.format(Number(t.tutar))} kaydı silinsin mi?`))
      return;
    const yanit = await fetch(`/api/tahsilatlar/${t.id}`, { method: "DELETE" });
    if (yanit.ok) yukle();
    else setHata("Silme başarısız oldu");
  }

  const secilenMusteriFirsatlari = form
    ? firsatlar.filter((f) => String(f.musteriId) === form.musteriId)
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tahsilatlar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Açık borçlar, vadeler ve tahsil durumu — vadesi geçenler kırmızı vurgulanır
          </p>
        </div>
        <button
          onClick={() => ac()}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
        >
          <Plus size={17} />
          Yeni Tahsilat
        </button>
      </div>

      <div className="mt-5 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {[{ deger: "", etiket: "Tümü" }, ...durumlar].map((f) => (
          <button
            key={f.deger}
            onClick={() => {
              setFiltre(f.deger);
              setSayfa(1);
            }}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
              filtre === f.deger
                ? "bg-slate-900 font-medium text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {f.etiket}
          </button>
        ))}
      </div>

      {hata && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{hata}</p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Müşteri</th>
              <th className="px-4 py-3 font-medium">Fırsat</th>
              <th className="px-4 py-3 text-right font-medium">Tutar</th>
              <th className="px-4 py-3 font-medium">Vade</th>
              <th className="px-4 py-3 font-medium">Ödeme</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 text-right font-medium">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {yukleniyor ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Yükleniyor…
                </td>
              </tr>
            ) : tahsilatlar.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              tahsilatlar.map((t) => {
                const gecikti = t.durum === "gecikti";
                const durumBilgi = durumlar.find((d) => d.deger === t.durum);
                return (
                  <tr key={t.id} className={gecikti ? "bg-red-50/60" : "hover:bg-slate-50"}>
                    <td className="px-4 py-3 font-medium text-slate-800">{t.musteri.ad}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.satisFirsati?.baslik ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {para.format(Number(t.tutar))}
                    </td>
                    <td className={`px-4 py-3 ${gecikti ? "font-semibold text-red-600" : "text-slate-600"}`}>
                      {tarihGoster(t.vadeTarihi)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.odemeTarihi ? (
                        <>
                          {tarihGoster(t.odemeTarihi)}
                          {t.odemeYontemi && (
                            <span className="text-xs text-slate-400">
                              {" "}
                              ({odemeYontemleri.find((y) => y.deger === t.odemeYontemi)?.etiket ?? t.odemeYontemi})
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          durumBilgi?.sinif ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {durumBilgi?.etiket ?? t.durum}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {t.durum !== "tahsil_edildi" && (
                          <button
                            onClick={() => tahsilEt(t)}
                            title="Tahsil edildi olarak işaretle"
                            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
                          >
                            <CheckCircle2 size={15} />
                            Tahsil Et
                          </button>
                        )}
                        <button
                          onClick={() => ac(t)}
                          title="Düzenle"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => sil(t)}
                          title="Sil"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Sayfalama sayfa={sayfa} toplam={toplam} limit={LIMIT} onDegis={setSayfa} />
      </div>

      {form && (
        <Modal
          baslik={duzenlenen ? "Tahsilatı Düzenle" : "Yeni Tahsilat"}
          kapat={kapat}
          genis
        >
          <form onSubmit={kaydet} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tMusteri" className={etiketSinifi}>
                  Müşteri <span className="text-red-500">*</span>
                </label>
                <select
                  id="tMusteri"
                  required
                  value={form.musteriId}
                  onChange={(e) =>
                    setForm({ ...form, musteriId: e.target.value, satisFirsatiId: "" })
                  }
                  className={girdiSinifi}
                >
                  <option value="">Seçin…</option>
                  {musteriler.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ad}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tFirsat" className={etiketSinifi}>
                  Bağlı Fırsat
                </label>
                <select
                  id="tFirsat"
                  value={form.satisFirsatiId}
                  onChange={(e) => setForm({ ...form, satisFirsatiId: e.target.value })}
                  disabled={!form.musteriId}
                  className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  <option value="">Yok</option>
                  {secilenMusteriFirsatlari.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.baslik ?? `Fırsat #${f.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tTutar" className={etiketSinifi}>
                  Tutar (₺) <span className="text-red-500">*</span>
                </label>
                <input
                  id="tTutar"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={form.tutar}
                  onChange={(e) => setForm({ ...form, tutar: e.target.value })}
                  className={girdiSinifi}
                />
              </div>
              <div>
                <label htmlFor="tVade" className={etiketSinifi}>
                  Vade Tarihi
                </label>
                <input
                  id="tVade"
                  type="date"
                  value={form.vadeTarihi}
                  onChange={(e) => setForm({ ...form, vadeTarihi: e.target.value })}
                  className={girdiSinifi}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tDurum" className={etiketSinifi}>
                  Durum
                </label>
                <select
                  id="tDurum"
                  value={form.durum}
                  onChange={(e) => setForm({ ...form, durum: e.target.value })}
                  className={girdiSinifi}
                >
                  {durumlar.map((d) => (
                    <option key={d.deger} value={d.deger}>
                      {d.etiket}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tYontem" className={etiketSinifi}>
                  Ödeme Yöntemi
                </label>
                <select
                  id="tYontem"
                  value={form.odemeYontemi}
                  onChange={(e) => setForm({ ...form, odemeYontemi: e.target.value })}
                  className={girdiSinifi}
                >
                  <option value="">Belirtilmedi</option>
                  {odemeYontemleri.map((y) => (
                    <option key={y.deger} value={y.deger}>
                      {y.etiket}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.durum === "tahsil_edildi" && (
              <div>
                <label htmlFor="tOdeme" className={etiketSinifi}>
                  Ödeme Tarihi
                </label>
                <input
                  id="tOdeme"
                  type="date"
                  value={form.odemeTarihi}
                  onChange={(e) => setForm({ ...form, odemeTarihi: e.target.value })}
                  className={girdiSinifi}
                />
                <p className="mt-1 text-xs text-slate-400">Boş bırakılırsa bugün kabul edilir.</p>
              </div>
            )}

            {formHata && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formHata}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={kapat}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={kaydediliyor}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
              >
                {kaydediliyor ? "Kaydediliyor…" : duzenlenen ? "Güncelle" : "Ekle"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
