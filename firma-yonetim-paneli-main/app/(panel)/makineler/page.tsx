"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Pencil, Plus, StickyNote, Trash2, Upload, UserCog } from "lucide-react";
import Modal from "@/components/Modal";
import TopluMakineEkle from "@/components/TopluMakineEkle";
import { etiketSinifi, girdiSinifi } from "@/lib/format";

type Sorumlu = { id: number; adSoyad: string; aktif: boolean };

type Makine = {
  id: number;
  ad: string;
  model: string | null;
  seriNo: string | null;
  durum: string;
  sorumluId: number | null;
  sorumlu: Sorumlu | null;
  durumNotu: string | null;
};

type CalisanSecenek = { id: number; adSoyad: string };

type Olay = {
  id: number;
  tip: string; // bakim | ariza
  aciklama: string;
  baslangic: string;
  bitis: string | null;
  sorumlu: { adSoyad: string } | null;
};

type FormVerisi = {
  ad: string;
  model: string;
  seriNo: string;
  durum: string;
  sorumluId: string; // select değeri; "" = sorumlu yok
  durumNotu: string;
};

const bosForm: FormVerisi = {
  ad: "",
  model: "",
  seriNo: "",
  durum: "calisiyor",
  sorumluId: "",
  durumNotu: "",
};

const durumlar = [
  { deger: "calisiyor", etiket: "Çalışıyor", sinif: "bg-emerald-100 text-emerald-700" },
  { deger: "bakimda", etiket: "Bakımda", sinif: "bg-amber-100 text-amber-700" },
  { deger: "arizali", etiket: "Arızalı", sinif: "bg-red-100 text-red-700" },
];

const filtreler = [{ deger: "", etiket: "Tümü" }, ...durumlar];

function tarihSaatGoster(t: string) {
  return new Date(t).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Olay süresi: bitmemişse şimdiye kadar
function sureGoster(baslangic: string, bitis: string | null) {
  const ms = (bitis ? new Date(bitis).getTime() : Date.now()) - new Date(baslangic).getTime();
  const saat = Math.floor(ms / 3_600_000);
  if (saat < 1) return "1 saatten az";
  if (saat < 48) return `${saat} saat`;
  return `${Math.floor(saat / 24)} gün`;
}

export default function MakinelerSayfasi() {
  const [makineler, setMakineler] = useState<Makine[]>([]);
  const [calisanlar, setCalisanlar] = useState<CalisanSecenek[]>([]);
  const [filtre, setFiltre] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  const [form, setForm] = useState<FormVerisi | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<Makine | null>(null);
  const [formHata, setFormHata] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // Tablodan bakımda/arızalı seçilince not istenen ara adım
  const [notluDurum, setNotluDurum] = useState<{
    makine: Makine;
    durum: string;
    not: string;
  } | null>(null);
  const [notHata, setNotHata] = useState("");

  // Bakım/arıza geçmişi modalı
  const [gecmis, setGecmis] = useState<{ makine: Makine; olaylar: Olay[] } | null>(null);

  // Toplu (Excel) ekleme modalı
  const [topluAcik, setTopluAcik] = useState(false);

  const yukle = useCallback(async () => {
    setHata("");
    try {
      const yanit = await fetch(`/api/makineler${filtre ? `?durum=${filtre}` : ""}`);
      if (!yanit.ok) throw new Error();
      setMakineler(await yanit.json());
    } catch {
      setHata("Makineler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, [filtre]);

  useEffect(() => {
    setYukleniyor(true);
    yukle();
  }, [yukle]);

  // Sorumlu seçimi için aktif çalışanlar
  useEffect(() => {
    fetch("/api/calisanlar?aktif=true")
      .then((y) => (y.ok ? y.json() : []))
      .then((liste: CalisanSecenek[]) =>
        setCalisanlar(liste.map((c) => ({ id: c.id, adSoyad: c.adSoyad })))
      )
      .catch(() => {});
  }, []);

  function yeniAc() {
    setDuzenlenen(null);
    setForm(bosForm);
    setFormHata("");
  }

  function duzenleAc(m: Makine) {
    setDuzenlenen(m);
    setForm({
      ad: m.ad,
      model: m.model ?? "",
      seriNo: m.seriNo ?? "",
      durum: m.durum,
      sorumluId: m.sorumluId ? String(m.sorumluId) : "",
      durumNotu: m.durumNotu ?? "",
    });
    setFormHata("");
  }

  function kapat() {
    setForm(null);
    setDuzenlenen(null);
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (form.durum !== "calisiyor" && !form.durumNotu.trim()) {
      setFormHata(
        form.durum === "arizali"
          ? "Arıza notu girmeden arızalı durumuna geçilemez"
          : "Bakım notu girmeden bakım durumuna geçilemez"
      );
      return;
    }
    setKaydediliyor(true);
    setFormHata("");

    const govde = {
      ad: form.ad.trim(),
      model: form.model.trim() || null,
      seriNo: form.seriNo.trim() || null,
      durum: form.durum,
      sorumluId: form.sorumluId ? Number(form.sorumluId) : null,
      durumNotu: form.durum === "calisiyor" ? null : form.durumNotu.trim() || null,
    };

    try {
      const yanit = await fetch(
        duzenlenen ? `/api/makineler/${duzenlenen.id}` : "/api/makineler",
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

  // Tablodaki durum menüsünden hızlı güncelleme:
  // bakımda/arızalıya geçişte not sorulur, çalışıyora geçişte not temizlenir
  function durumSecildi(m: Makine, durum: string) {
    if (durum === m.durum) return;
    if (durum === "calisiyor") {
      durumKaydet(m.id, durum, null);
    } else {
      setNotluDurum({ makine: m, durum, not: m.durumNotu ?? "" });
      setNotHata("");
    }
  }

  async function durumKaydet(id: number, durum: string, durumNotu: string | null) {
    const yanit = await fetch(`/api/makineler/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum, durumNotu }),
    });
    if (yanit.ok) {
      setNotluDurum(null);
      yukle();
    } else {
      const mesaj = "Durum güncellenemedi";
      if (notluDurum) setNotHata(mesaj);
      else setHata(mesaj);
    }
  }

  async function gecmisAc(m: Makine) {
    setHata("");
    try {
      const yanit = await fetch(`/api/makineler/${m.id}/gecmis`);
      if (!yanit.ok) throw new Error();
      const j = await yanit.json();
      setGecmis({ makine: m, olaylar: j.olaylar });
    } catch {
      setHata("Geçmiş yüklenemedi");
    }
  }

  async function sil(m: Makine) {
    if (!window.confirm(`"${m.ad}" silinsin mi? Bu işlem geri alınamaz.`)) return;
    const yanit = await fetch(`/api/makineler/${m.id}`, { method: "DELETE" });
    if (yanit.ok) {
      yukle();
    } else {
      const j = await yanit.json().catch(() => null);
      setHata(j?.hata ?? "Silme başarısız oldu");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Makineler / Ekipman</h1>
          <p className="mt-1 text-sm text-slate-500">
            Makine ekleyin, sorumlularını ve durumlarını takip edin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTopluAcik(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Upload size={16} />
            Excel'den Toplu Ekle
          </button>
          <button
            onClick={yeniAc}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
          >
            <Plus size={17} />
            Yeni Makine
          </button>
        </div>
      </div>

      <div className="mt-5 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {filtreler.map((f) => (
          <button
            key={f.deger}
            onClick={() => setFiltre(f.deger)}
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
              <th className="px-4 py-3 font-medium">Makine</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Seri No</th>
              <th className="px-4 py-3 font-medium">Sorumlu</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 text-right font-medium">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {yukleniyor ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Yükleniyor…
                </td>
              </tr>
            ) : makineler.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Kayıt bulunamadı. Sağ üstten yeni makine ekleyebilirsiniz.
                </td>
              </tr>
            ) : (
              makineler.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{m.ad}</td>
                  <td className="px-4 py-3 text-slate-600">{m.model ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{m.seriNo ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.sorumlu ? (
                      <span className="flex items-center gap-1.5">
                        <UserCog size={15} className="shrink-0 text-slate-400" />
                        {m.sorumlu.adSoyad}
                        {!m.sorumlu.aktif && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            Pasif
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.durum}
                      onChange={(e) => durumSecildi(m, e.target.value)}
                      className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium outline-none ${
                        durumlar.find((d) => d.deger === m.durum)?.sinif ??
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {durumlar.map((d) => (
                        <option key={d.deger} value={d.deger}>
                          {d.etiket}
                        </option>
                      ))}
                    </select>
                    {m.durum !== "calisiyor" && m.durumNotu && (
                      <p
                        className="mt-1.5 flex max-w-56 items-start gap-1 text-xs text-slate-500"
                        title={m.durumNotu}
                      >
                        <StickyNote size={13} className="mt-0.5 shrink-0 text-amber-500" />
                        <span className="truncate">{m.durumNotu}</span>
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => gecmisAc(m)}
                        title="Bakım / arıza geçmişi"
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => duzenleAc(m)}
                        title="Düzenle"
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => sil(m)}
                        title="Sil"
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal baslik={duzenlenen ? "Makineyi Düzenle" : "Yeni Makine"} kapat={kapat}>
          <form onSubmit={kaydet} className="space-y-4">
            <div>
              <label htmlFor="ad" className={etiketSinifi}>
                Makine Adı <span className="text-red-500">*</span>
              </label>
              <input
                id="ad"
                required
                value={form.ad}
                onChange={(e) => setForm({ ...form, ad: e.target.value })}
                className={girdiSinifi}
                placeholder="Örn: CNC Freze"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="model" className={etiketSinifi}>
                  Model
                </label>
                <input
                  id="model"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className={girdiSinifi}
                  placeholder="Örn: Biesse Rover A"
                />
              </div>
              <div>
                <label htmlFor="seriNo" className={etiketSinifi}>
                  Seri No
                </label>
                <input
                  id="seriNo"
                  value={form.seriNo}
                  onChange={(e) => setForm({ ...form, seriNo: e.target.value })}
                  className={girdiSinifi}
                  placeholder="Örn: CNC-2021-001"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sorumluId" className={etiketSinifi}>
                Sorumlu
              </label>
              <select
                id="sorumluId"
                value={form.sorumluId}
                onChange={(e) => setForm({ ...form, sorumluId: e.target.value })}
                className={girdiSinifi}
              >
                <option value="">— Sorumlu atanmadı —</option>
                {calisanlar.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.adSoyad}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="durum" className={etiketSinifi}>
                Durum
              </label>
              <select
                id="durum"
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

            {form.durum !== "calisiyor" && (
              <div>
                <label htmlFor="durumNotu" className={etiketSinifi}>
                  {form.durum === "arizali" ? "Arıza Notu" : "Bakım Notu"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="durumNotu"
                  rows={2}
                  required
                  value={form.durumNotu}
                  onChange={(e) => setForm({ ...form, durumNotu: e.target.value })}
                  className={girdiSinifi}
                  placeholder={
                    form.durum === "arizali"
                      ? "Örn: Mil rulmanı ses yapıyor, yedek parça bekleniyor"
                      : "Örn: Yıllık periyodik bakım, yağ değişimi"
                  }
                />
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

      {gecmis && (
        <Modal baslik={`${gecmis.makine.ad} — Bakım / Arıza Geçmişi`} kapat={() => setGecmis(null)} genis>
          {gecmis.olaylar.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Bu makine için henüz bakım veya arıza kaydı yok.
            </p>
          ) : (
            <ol className="space-y-3">
              {gecmis.olaylar.map((o) => (
                <li key={o.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        o.tip === "ariza"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {o.tip === "ariza" ? "Arıza" : "Bakım"}
                    </span>
                    {!o.bitis && (
                      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                        Devam ediyor
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-500">
                      {sureGoster(o.baslangic, o.bitis)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">{o.aciklama || "—"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <UserCog size={13} className="shrink-0" />
                      {o.sorumlu?.adSoyad ?? "Sorumlu atanmadı"}
                    </span>
                    <span>
                      {tarihSaatGoster(o.baslangic)}
                      {" → "}
                      {o.bitis ? tarihSaatGoster(o.bitis) : "…"}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}

      {notluDurum && (
        <Modal
          baslik={notluDurum.durum === "arizali" ? "Arıza Kaydı" : "Bakıma Al"}
          kapat={() => setNotluDurum(null)}
        >
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">{notluDurum.makine.ad}</span>{" "}
            {notluDurum.durum === "arizali" ? "arızalı" : "bakımda"} olarak işaretlenecek.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
            <UserCog size={15} className="shrink-0 text-slate-400" />
            Sorumlu:{" "}
            <span className="font-medium text-slate-800">
              {notluDurum.makine.sorumlu?.adSoyad ?? "atanmadı"}
            </span>
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const not = notluDurum.not.trim();
              if (!not) {
                setNotHata(
                  notluDurum.durum === "arizali"
                    ? "Arıza notu girmeden arızalı durumuna geçilemez"
                    : "Bakım notu girmeden bakım durumuna geçilemez"
                );
                return;
              }
              durumKaydet(notluDurum.makine.id, notluDurum.durum, not);
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label htmlFor="durumNot" className={etiketSinifi}>
                {notluDurum.durum === "arizali"
                  ? "Arıza Notu (ne arızası?)"
                  : "Bakım Notu (ne bakımı?)"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                id="durumNot"
                rows={3}
                required
                autoFocus
                value={notluDurum.not}
                onChange={(e) => setNotluDurum({ ...notluDurum, not: e.target.value })}
                className={girdiSinifi}
                placeholder={
                  notluDurum.durum === "arizali"
                    ? "Örn: Mil rulmanı ses yapıyor, yedek parça bekleniyor"
                    : "Örn: Yıllık periyodik bakım, yağ değişimi"
                }
              />
            </div>

            {notHata && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{notHata}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNotluDurum(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                  notluDurum.durum === "arizali"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                Kaydet
              </button>
            </div>
          </form>
        </Modal>
      )}

      {topluAcik && (
        <TopluMakineEkle
          kapat={() => setTopluAcik(false)}
          tamam={(eklenen) => {
            setTopluAcik(false);
            setHata("");
            if (eklenen > 0) {
              setYukleniyor(true);
              yukle();
            }
          }}
        />
      )}
    </div>
  );
}
