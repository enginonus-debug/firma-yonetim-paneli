"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import Modal from "@/components/Modal";
import Sayfalama from "@/components/Sayfalama";
import { etiketSinifi, girdiSinifi, para, tarihGoster } from "@/lib/format";

type Kalem = { aciklama: string; miktar: number; birim: string; birimFiyat: number };
type Ek = { id: number; dosyaAd: string; mimeTip: string; boyut: number };

// Teklif geçmişi olayı: verilen tutar, revizyonlar ve kararlar buradan izlenir
type Olay = {
  tip: "olusturma" | "revize" | "onay" | "ret";
  zaman: string;
  kullaniciAd: string;
  toplam: number;
  iskontoOrani: number;
  aciklama?: string | null;
};

type Teklif = {
  id: number;
  baslik: string;
  durum: string;
  araToplam: string;
  toplam: string;
  kdvOrani: string;
  iskontoOrani: string;
  revizyonNo: number;
  gecmis: Olay[] | null;
  kalemler: Kalem[];
  notlar: string | null;
  gecerlilikTarihi: string | null;
  kararNotu: string | null;
  satisFirsatiId: number;
  satisFirsati: {
    id: number;
    baslik: string | null;
    durum: string;
    musteri: { id: number; ad: string };
  };
  olusturan: { id: number; adSoyad: string } | null;
  onaylayan: { id: number; adSoyad: string } | null;
  ekler: Ek[];
};

type Firsat = { id: number; baslik: string | null; musteri: { ad: string } };
type Yonetici = { id: number; adSoyad: string; rol: string };

type FormVerisi = {
  satisFirsatiId: string;
  baslik: string;
  kalemler: Kalem[];
  kdvOrani: string;
  iskontoOrani: string;
  gecerlilikTarihi: string;
  notlar: string;
  onaylayanId: string;
};

const bosKalem: Kalem = { aciklama: "", miktar: 1, birim: "adet", birimFiyat: 0 };
const bosForm: FormVerisi = {
  satisFirsatiId: "",
  baslik: "",
  kalemler: [{ ...bosKalem }],
  kdvOrani: "20",
  iskontoOrani: "0",
  gecerlilikTarihi: "",
  notlar: "",
  onaylayanId: "",
};

const durumlar = [
  { deger: "onay_bekliyor", etiket: "Onay Bekliyor", sinif: "bg-amber-100 text-amber-700" },
  { deger: "onaylandi", etiket: "Onaylandı", sinif: "bg-emerald-100 text-emerald-700" },
  { deger: "reddedildi", etiket: "Reddedildi", sinif: "bg-red-100 text-red-600" },
];

const LIMIT = 20;

function boyutGoster(b: number) {
  return b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function TekliflerSayfasi() {
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [durum, setDurum] = useState("");
  const [sayfa, setSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [rol, setRol] = useState("");
  const [benId, setBenId] = useState<number | null>(null);

  const [firsatlar, setFirsatlar] = useState<Firsat[]>([]);
  const [yoneticiler, setYoneticiler] = useState<Yonetici[]>([]);

  const [form, setForm] = useState<FormVerisi | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<Teklif | null>(null);
  const [ekDosyalar, setEkDosyalar] = useState<File[]>([]); // yeni teklifle birlikte yüklenecekler
  const [formHata, setFormHata] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const [detay, setDetay] = useState<Teklif | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata("");
    try {
      const p = new URLSearchParams({ sayfa: String(sayfa), limit: String(LIMIT) });
      if (durum) p.set("durum", durum);
      const yanit = await fetch(`/api/teklifler?${p}`);
      if (!yanit.ok) throw new Error();
      const j = await yanit.json();
      setTeklifler(j.veriler);
      setToplam(j.toplam);
    } catch {
      setHata("Teklifler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, [sayfa, durum]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  // Rol bilgisi (onay/ret butonları yalnızca yöneticide görünür)
  useEffect(() => {
    fetch("/api/hesap")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setRol(j.rol);
        setBenId(j.id);
      })
      .catch(() => {});
  }, []);

  async function secenekleriYukle() {
    if (firsatlar.length === 0) {
      const r = await fetch("/api/satis-firsatlari?limit=100");
      if (r.ok) {
        const j = await r.json();
        setFirsatlar(j.veriler);
      }
    }
    if (yoneticiler.length === 0) {
      const r = await fetch("/api/kullanicilar/secenekler");
      if (r.ok) {
        const j: Yonetici[] = await r.json();
        setYoneticiler(j.filter((k) => k.rol === "admin"));
      }
    }
  }

  function yeniAc() {
    secenekleriYukle();
    setDuzenlenen(null);
    setEkDosyalar([]);
    // URL'de ?firsat=ID varsa o fırsatı ön-seç
    const firsatId = new URLSearchParams(window.location.search).get("firsat");
    setForm({ ...bosForm, kalemler: [{ ...bosKalem }], satisFirsatiId: firsatId ?? "" });
    setFormHata("");
  }

  function duzenleAc(t: Teklif) {
    secenekleriYukle();
    setDuzenlenen(t);
    setEkDosyalar([]);
    setForm({
      satisFirsatiId: String(t.satisFirsatiId),
      baslik: t.baslik,
      kalemler: t.kalemler.map((k) => ({ ...k })),
      kdvOrani: String(Number(t.kdvOrani)),
      iskontoOrani: String(Number(t.iskontoOrani)),
      gecerlilikTarihi: t.gecerlilikTarihi?.slice(0, 10) ?? "",
      notlar: t.notlar ?? "",
      onaylayanId: t.onaylayan ? String(t.onaylayan.id) : "",
    });
    setFormHata("");
  }

  function kalemDegistir(i: number, alan: keyof Kalem, deger: string) {
    if (!form) return;
    const kalemler = form.kalemler.map((k, idx) =>
      idx === i
        ? { ...k, [alan]: alan === "aciklama" || alan === "birim" ? deger : Number(deger) }
        : k
    );
    setForm({ ...form, kalemler });
  }

  function kalemEkle() {
    if (!form) return;
    setForm({ ...form, kalemler: [...form.kalemler, { ...bosKalem }] });
  }

  function kalemSil(i: number) {
    if (!form) return;
    setForm({ ...form, kalemler: form.kalemler.filter((_, idx) => idx !== i) });
  }

  const formAraToplam = form
    ? form.kalemler.reduce((t, k) => t + (k.miktar || 0) * (k.birimFiyat || 0), 0)
    : 0;
  const formIskonto = form ? (formAraToplam * (Number(form.iskontoOrani) || 0)) / 100 : 0;
  const formToplam = form
    ? (formAraToplam - formIskonto) * (1 + (Number(form.kdvOrani) || 0) / 100)
    : 0;

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setKaydediliyor(true);
    setFormHata("");

    const govde = {
      satisFirsatiId: Number(form.satisFirsatiId),
      baslik: form.baslik.trim(),
      kalemler: form.kalemler.map((k) => ({
        aciklama: k.aciklama.trim(),
        miktar: Number(k.miktar),
        birim: k.birim.trim() || "adet",
        birimFiyat: Number(k.birimFiyat),
      })),
      kdvOrani: Number(form.kdvOrani),
      iskontoOrani: Number(form.iskontoOrani) || 0,
      gecerlilikTarihi: form.gecerlilikTarihi || null,
      notlar: form.notlar.trim() || null,
      onaylayanId: form.onaylayanId ? Number(form.onaylayanId) : null,
    };

    try {
      const yanit = await fetch(
        duzenlenen ? `/api/teklifler/${duzenlenen.id}` : "/api/teklifler",
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
      // Yeni teklife seçilen belgeleri (reçete/maliyet) sırayla yükle
      if (!duzenlenen && ekDosyalar.length > 0) {
        const olusan = await yanit.json();
        for (const dosya of ekDosyalar) {
          const fd = new FormData();
          fd.append("dosya", dosya);
          const ekY = await fetch(`/api/teklifler/${olusan.id}/ekler`, {
            method: "POST",
            body: fd,
          });
          if (!ekY.ok) {
            const j = await ekY.json().catch(() => null);
            setFormHata(
              `Teklif kaydedildi ancak "${dosya.name}" eklenemedi: ${j?.hata ?? "hata"}`
            );
            setForm(null);
            setDuzenlenen(null);
            setEkDosyalar([]);
            yukle();
            return;
          }
        }
      }
      setForm(null);
      setDuzenlenen(null);
      setEkDosyalar([]);
      yukle();
    } catch {
      setFormHata("Sunucuya ulaşılamadı");
    } finally {
      setKaydediliyor(false);
    }
  }

  async function sil(t: Teklif) {
    if (!window.confirm(`"${t.baslik}" teklifi silinsin mi?`)) return;
    const yanit = await fetch(`/api/teklifler/${t.id}`, { method: "DELETE" });
    if (yanit.ok) yukle();
    else {
      const j = await yanit.json().catch(() => null);
      setHata(j?.hata ?? "Silme başarısız oldu");
    }
  }

  // Detay modalı tazeleme (ek yükleme/karar sonrası)
  async function detayTazele(id: number) {
    const r = await fetch(`/api/teklifler/${id}`);
    if (r.ok) setDetay(await r.json());
    yukle();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Fiyat Teklifleri</h1>
          <p className="mt-1 text-sm text-slate-500">
            Satış fırsatından teklif hazırlayın, yönetici onayına gönderin, PDF olarak çıkarın
          </p>
        </div>
        <button
          onClick={yeniAc}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
        >
          <Plus size={17} />
          Yeni Teklif
        </button>
      </div>

      <div className="mt-4 inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-1">
        {[{ deger: "", etiket: "Tümü" }, ...durumlar].map((d) => (
          <button
            key={d.deger}
            onClick={() => {
              setDurum(d.deger);
              setSayfa(1);
            }}
            className={`rounded-md px-3.5 py-1.5 text-sm transition-colors ${
              durum === d.deger
                ? "bg-slate-900 font-medium text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {d.etiket}
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
              <th className="px-4 py-3 font-medium">Teklif</th>
              <th className="px-4 py-3 font-medium">Müşteri</th>
              <th className="px-4 py-3 text-right font-medium">Toplam</th>
              <th className="px-4 py-3 text-center font-medium">Ek</th>
              <th className="px-4 py-3 font-medium">Onaylayan</th>
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
            ) : teklifler.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              teklifler.map((t) => {
                const d = durumlar.find((x) => x.deger === t.durum);
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetay(t)}
                        className="text-left font-medium text-slate-800 hover:text-sky-700"
                      >
                        {t.baslik}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.satisFirsati.musteri.ad}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {para.format(Number(t.toplam))}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {t.ekler.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip size={13} />
                          {t.ekler.length}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.onaylayan?.adSoyad ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${d?.sinif ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {d?.etiket ?? t.durum}
                      </span>
                      {t.revizyonNo > 0 && (
                        <span
                          className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700"
                          title={`Bu teklif ${t.revizyonNo} kez revize edildi (iskonto)`}
                        >
                          Revize {t.revizyonNo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetay(t)}
                          title="Detay"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                        >
                          <FileText size={16} />
                        </button>
                        <a
                          href={`/api/teklifler/${t.id}/yazdir`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Yazdır / PDF"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Printer size={16} />
                        </a>
                        {t.durum === "onay_bekliyor" && (
                          <button
                            onClick={() => duzenleAc(t)}
                            title="Düzenle"
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {(t.durum === "onay_bekliyor" ||
                          benId === t.olusturan?.id ||
                          benId === t.onaylayan?.id) && (
                          <button
                            onClick={() => sil(t)}
                            title="Sil"
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
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

      {/* Oluştur / Düzenle */}
      {form && (
        <Modal
          baslik={duzenlenen ? "Teklifi Düzenle" : "Yeni Fiyat Teklifi"}
          kapat={() => {
            setForm(null);
            setDuzenlenen(null);
          }}
          genis
        >
          <form onSubmit={kaydet} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="tFirsat" className={etiketSinifi}>
                  Satış Fırsatı <span className="text-red-500">*</span>
                </label>
                <select
                  id="tFirsat"
                  required
                  value={form.satisFirsatiId}
                  onChange={(e) => setForm({ ...form, satisFirsatiId: e.target.value })}
                  className={girdiSinifi}
                >
                  <option value="">Seçin…</option>
                  {firsatlar.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.musteri.ad} — {f.baslik ?? "Fırsat #" + f.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tOnaylayan" className={etiketSinifi}>
                  Onaya Gönderilecek Yönetici <span className="text-red-500">*</span>
                </label>
                <select
                  id="tOnaylayan"
                  required
                  value={form.onaylayanId}
                  onChange={(e) => setForm({ ...form, onaylayanId: e.target.value })}
                  className={girdiSinifi}
                >
                  <option value="">Seçin…</option>
                  {yoneticiler.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.adSoyad}
                    </option>
                  ))}
                </select>
                {yoneticiler.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    Onay verebilecek yönetici (firma admini) bulunamadı.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="tBaslik" className={etiketSinifi}>
                Teklif Başlığı <span className="text-red-500">*</span>
              </label>
              <input
                id="tBaslik"
                required
                value={form.baslik}
                onChange={(e) => setForm({ ...form, baslik: e.target.value })}
                className={girdiSinifi}
                placeholder="Örn: 50 adet yemek masası imalatı"
              />
            </div>

            {/* Teklif şablonu — kalemler */}
            <div>
              <label className={etiketSinifi}>Teklif Kalemleri</label>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-2 py-2 font-medium">Açıklama</th>
                      <th className="w-20 px-2 py-2 font-medium">Miktar</th>
                      <th className="w-24 px-2 py-2 font-medium">Birim</th>
                      <th className="w-32 px-2 py-2 font-medium">Birim Fiyat</th>
                      <th className="w-28 px-2 py-2 text-right font-medium">Tutar</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.kalemler.map((k, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-2 py-1.5">
                          <input
                            required
                            value={k.aciklama}
                            onChange={(e) => kalemDegistir(i, "aciklama", e.target.value)}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-sky-500"
                            placeholder="Ürün / hizmet"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={k.miktar}
                            onChange={(e) => kalemDegistir(i, "miktar", e.target.value)}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-sky-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={k.birim}
                            onChange={(e) => kalemDegistir(i, "birim", e.target.value)}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-sky-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={k.birimFiyat}
                            onChange={(e) => kalemDegistir(i, "birimFiyat", e.target.value)}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-sky-500"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-600">
                          {para.format((k.miktar || 0) * (k.birimFiyat || 0))}
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          {form.kalemler.length > 1 && (
                            <button
                              type="button"
                              onClick={() => kalemSil(i)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Kalemi sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={kalemEkle}
                className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Plus size={15} />
                Kalem Ekle
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label htmlFor="tKdv" className={etiketSinifi}>
                  KDV (%)
                </label>
                <input
                  id="tKdv"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.kdvOrani}
                  onChange={(e) => setForm({ ...form, kdvOrani: e.target.value })}
                  className={girdiSinifi}
                />
              </div>
              <div>
                <label htmlFor="tIskonto" className={etiketSinifi}>
                  İskonto (%)
                </label>
                <input
                  id="tIskonto"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.iskontoOrani}
                  onChange={(e) => setForm({ ...form, iskontoOrani: e.target.value })}
                  className={girdiSinifi}
                />
              </div>
              <div>
                <label htmlFor="tGecerlilik" className={etiketSinifi}>
                  Geçerlilik Tarihi
                </label>
                <input
                  id="tGecerlilik"
                  type="date"
                  value={form.gecerlilikTarihi}
                  onChange={(e) => setForm({ ...form, gecerlilikTarihi: e.target.value })}
                  className={girdiSinifi}
                />
              </div>
              <div className="flex flex-col justify-end">
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Ara Toplam</span>
                    <span>{para.format(formAraToplam)}</span>
                  </div>
                  {formIskonto > 0 && (
                    <div className="mt-1 flex justify-between text-slate-500">
                      <span>İskonto</span>
                      <span>−{para.format(formIskonto)}</span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between font-semibold text-slate-800">
                    <span>Genel Toplam</span>
                    <span>{para.format(formToplam)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="tNotlar" className={etiketSinifi}>
                Hazırlayan Notu / Ön Görüş
              </label>
              <textarea
                id="tNotlar"
                rows={2}
                value={form.notlar}
                onChange={(e) => setForm({ ...form, notlar: e.target.value })}
                className={girdiSinifi}
                placeholder="Maliyet açıklaması, teslim koşulları, kendi değerlendirmeniz… (onaylayan yönetici görür)"
              />
              <p className="mt-1 text-xs text-slate-400">
                Bu not, teklifi onaylayacak yönetici tarafından görülür.
              </p>
            </div>

            {/* Belge ekleri — reçete görüntüsü / maliyet dosyaları */}
            {!duzenlenen && (
              <div>
                <label className={etiketSinifi}>Reçete / Maliyet Belgeleri (isteğe bağlı)</label>
                <input
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.xml,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const secilen = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (secilen.length > 0) {
                      setEkDosyalar((onceki) => [...onceki, ...secilen].slice(0, 5));
                    }
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-200"
                />
                {ekDosyalar.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {ekDosyalar.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Paperclip size={12} className="shrink-0 text-slate-400" />
                          {d.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEkDosyalar((o) => o.filter((_, x) => x !== i))}
                          className="shrink-0 rounded p-0.5 text-slate-400 hover:text-red-600"
                          title="Kaldır"
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  En fazla 5 dosya · pdf, xml, doc, docx, xls, png/jpg. Kaydedince otomatik yüklenir.
                </p>
              </div>
            )}

            {formHata && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formHata}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setForm(null);
                  setDuzenlenen(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={kaydediliyor}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
              >
                {kaydediliyor
                  ? "Kaydediliyor…"
                  : duzenlenen
                    ? "Güncelle"
                    : "Onaya Gönder"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detay */}
      {detay && (
        <TeklifDetay
          teklif={detay}
          rol={rol}
          benId={benId}
          kapat={() => setDetay(null)}
          tazele={() => detayTazele(detay.id)}
        />
      )}
    </div>
  );
}

// ---- Teklif detay modalı: kalemler, ekler, karar, iskonto/revizyon, geçmiş ----
function TeklifDetay({
  teklif,
  rol,
  benId,
  kapat,
  tazele,
}: {
  teklif: Teklif;
  rol: string;
  benId: number | null;
  kapat: () => void;
  tazele: () => void;
}) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kararNotu, setKararNotu] = useState("");
  const [islemHata, setIslemHata] = useState("");
  const [iskontoGiris, setIskontoGiris] = useState("");
  const d = durumlar.find((x) => x.deger === teklif.durum);
  const onayBekliyor = teklif.durum === "onay_bekliyor";
  const onaylandi = teklif.durum === "onaylandi";
  const yonetici = rol === "admin";
  // İskonto (revizyon) yalnızca teklifi oluşturan veya onaylayan tarafından girilebilir
  const iskontoGirebilir =
    onaylandi && (benId === teklif.olusturan?.id || benId === teklif.onaylayan?.id);
  const iskontoOrani = Number(teklif.iskontoOrani);
  const araToplamSayi = Number(teklif.araToplam);
  const iskontoTutar = (araToplamSayi * iskontoOrani) / 100;
  const kdvTutar = Number(teklif.toplam) - (araToplamSayi - iskontoTutar);

  async function ekYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    e.target.value = "";
    if (!dosya) return;
    setYukleniyor(true);
    setIslemHata("");
    const fd = new FormData();
    fd.append("dosya", dosya);
    const r = await fetch(`/api/teklifler/${teklif.id}/ekler`, { method: "POST", body: fd });
    setYukleniyor(false);
    if (r.ok) tazele();
    else {
      const j = await r.json().catch(() => null);
      setIslemHata(j?.hata ?? "Dosya yüklenemedi");
    }
  }

  async function ekSil(ek: Ek) {
    if (!window.confirm(`"${ek.dosyaAd}" eki silinsin mi?`)) return;
    const r = await fetch(`/api/teklifler/${teklif.id}/ekler/${ek.id}`, { method: "DELETE" });
    if (r.ok) tazele();
    else setIslemHata("Ek silinemedi");
  }

  // Onaylı teklife müşteri iskontosu girer; teklif yeniden onaya düşer (revizyon)
  async function iskontoGonder() {
    const oran = Number(iskontoGiris);
    if (!iskontoGiris.trim() || Number.isNaN(oran) || oran < 0 || oran > 100) {
      setIslemHata("0–100 arası bir iskonto oranı girin");
      return;
    }
    if (
      !window.confirm(
        `%${oran} iskonto girilecek ve teklif yeniden yönetici onayına gönderilecek. Devam edilsin mi?`
      )
    )
      return;
    setYukleniyor(true);
    setIslemHata("");
    const r = await fetch(`/api/teklifler/${teklif.id}/iskonto`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iskontoOrani: oran }),
    });
    setYukleniyor(false);
    if (r.ok) {
      setIskontoGiris("");
      tazele();
    } else {
      const j = await r.json().catch(() => null);
      setIslemHata(j?.hata ?? "İskonto girilemedi");
    }
  }

  async function karar(karar: "onayla" | "reddet") {
    if (karar === "reddet" && !kararNotu.trim()) {
      setIslemHata("Ret için açıklama girin");
      return;
    }
    setYukleniyor(true);
    setIslemHata("");
    const r = await fetch(`/api/teklifler/${teklif.id}/karar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ karar, kararNotu: kararNotu.trim() || null }),
    });
    setYukleniyor(false);
    if (r.ok) tazele();
    else {
      const j = await r.json().catch(() => null);
      setIslemHata(j?.hata ?? "İşlem başarısız");
    }
  }

  return (
    <Modal baslik={teklif.baslik} kapat={kapat} genis>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${d?.sinif ?? "bg-slate-100 text-slate-600"}`}
          >
            {d?.etiket ?? teklif.durum}
          </span>
          {teklif.revizyonNo > 0 && (
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
              Revize {teklif.revizyonNo} · İskonto %{iskontoOrani}
            </span>
          )}
          <span className="text-slate-500">
            {teklif.satisFirsati.musteri.ad} · {teklif.satisFirsati.baslik ?? "—"}
          </span>
          <a
            href={`/api/teklifler/${teklif.id}/yazdir`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Printer size={14} />
            Yazdır / PDF
          </a>
        </div>

        {/* Kalemler */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-medium">Açıklama</th>
                <th className="px-3 py-2 text-right font-medium">Miktar</th>
                <th className="px-3 py-2 text-right font-medium">Birim Fiyat</th>
                <th className="px-3 py-2 text-right font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {teklif.kalemler.map((k, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{k.aciklama}</td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {k.miktar} {k.birim}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {para.format(k.birimFiyat)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {para.format(k.miktar * k.birimFiyat)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 text-slate-500">
                <td colSpan={3} className="px-3 py-1.5 text-right">
                  Ara Toplam
                </td>
                <td className="px-3 py-1.5 text-right">{para.format(araToplamSayi)}</td>
              </tr>
              {iskontoOrani > 0 && (
                <tr className="text-slate-500">
                  <td colSpan={3} className="px-3 py-1.5 text-right">
                    İskonto (%{iskontoOrani})
                  </td>
                  <td className="px-3 py-1.5 text-right">−{para.format(iskontoTutar)}</td>
                </tr>
              )}
              <tr className="text-slate-500">
                <td colSpan={3} className="px-3 py-1.5 text-right">
                  KDV (%{Number(teklif.kdvOrani)})
                </td>
                <td className="px-3 py-1.5 text-right">{para.format(kdvTutar)}</td>
              </tr>
              <tr className="border-t border-slate-200 font-semibold text-slate-800">
                <td colSpan={3} className="px-3 py-2 text-right">
                  Genel Toplam
                </td>
                <td className="px-3 py-2 text-right">{para.format(Number(teklif.toplam))}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {teklif.notlar && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
            <p className="mb-1 text-xs font-medium text-slate-500">Notlar</p>
            <p className="whitespace-pre-wrap">{teklif.notlar}</p>
          </div>
        )}

        {teklif.gecerlilikTarihi && (
          <p className="text-xs text-slate-500">
            Geçerlilik: {tarihGoster(teklif.gecerlilikTarihi)}
          </p>
        )}

        {/* Ekler */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium text-slate-700">
              Ekler (reçete / maliyet belgeleri)
            </p>
            {onayBekliyor && (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                <Upload size={14} />
                Dosya Ekle
                <input
                  type="file"
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.xml,.doc,.docx,.xls,.xlsx"
                  onChange={ekYukle}
                  disabled={yukleniyor}
                />
              </label>
            )}
          </div>
          {teklif.ekler.length === 0 ? (
            <p className="rounded-lg border-2 border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
              {onayBekliyor
                ? "Henüz ek yok. Reçete görüntüsü veya maliyet dosyası (pdf, xml, doc, docx, xls) ekleyin."
                : "Bu teklifte ek yok."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {teklif.ekler.map((ek) => (
                <li key={ek.id} className="flex items-center gap-2 px-3 py-2">
                  <Paperclip size={14} className="shrink-0 text-slate-400" />
                  <span className="truncate text-slate-700">{ek.dosyaAd}</span>
                  <span className="ml-1 shrink-0 text-xs text-slate-400">
                    {boyutGoster(ek.boyut)}
                  </span>
                  <a
                    href={`/api/teklifler/${teklif.id}/ekler/${ek.id}?goster=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    title="Görüntüle / indir"
                  >
                    <Download size={15} />
                  </a>
                  {onayBekliyor && (
                    <button
                      onClick={() => ekSil(ek)}
                      className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Karar durumu / yönetici onayı */}
        {teklif.kararNotu && !onayBekliyor && (
          <div
            className={`rounded-lg px-3 py-2 ${
              teklif.durum === "onaylandi"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            <p className="text-xs font-medium">Yönetici Notu</p>
            <p>{teklif.kararNotu}</p>
          </div>
        )}

        {!onayBekliyor && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Bu teklif karara bağlandı: içeriği ve ekleri artık değiştirilemez. Teklifi
            yalnızca oluşturan veya onaylayan kişi silebilir.
            {onaylandi &&
              " Tek istisna müşteri iskontosudur: iskonto girilirse teklif yeniden onaya düşer."}
          </p>
        )}

        {/* Müşteri iskontosu (revizyon) — yalnızca onaylı teklifte, oluşturan/onaylayana açık */}
        {iskontoGirebilir && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
            <p className="mb-1 font-medium text-slate-700">Müşteri İskontosu (Revizyon)</p>
            <p className="mb-2 text-xs text-slate-500">
              Müşteri iskonto isterse oranı girin; teklif tutarı yeniden hesaplanır ve teklif
              tekrar yönetici onayına gönderilir.
              {iskontoOrani > 0 && ` Mevcut iskonto: %${iskontoOrani}.`}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={iskontoGiris}
                onChange={(e) => setIskontoGiris(e.target.value)}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
                placeholder="İskonto %"
              />
              <button
                onClick={iskontoGonder}
                disabled={yukleniyor}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                İskonto Gir ve Onaya Gönder
              </button>
            </div>
          </div>
        )}

        {onayBekliyor && yonetici && (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 font-medium text-slate-700">Yönetici Kararı</p>
            <textarea
              rows={2}
              value={kararNotu}
              onChange={(e) => setKararNotu(e.target.value)}
              className={girdiSinifi}
              placeholder="Karar açıklaması (ret için zorunlu)"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => karar("onayla")}
                disabled={yukleniyor}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckCircle2 size={16} />
                Onayla
              </button>
              <button
                onClick={() => karar("reddet")}
                disabled={yukleniyor}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                <XCircle size={16} />
                Reddet
              </button>
            </div>
          </div>
        )}

        {onayBekliyor && !yonetici && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Bu teklif {teklif.onaylayan?.adSoyad ?? "yönetici"} onayını bekliyor.
          </p>
        )}

        {/* Teklif geçmişi: ne teklif verildi, nasıl revize edildi, kararlar */}
        {(teklif.gecmis?.length ?? 0) > 0 && (
          <div>
            <p className="mb-2 font-medium text-slate-700">Teklif Geçmişi</p>
            <ol className="space-y-1.5 border-l-2 border-slate-200 pl-4">
              {teklif.gecmis!.map((o, i) => {
                const etiket = {
                  olusturma: { ad: "Teklif verildi", renk: "text-sky-700" },
                  revize: { ad: `Revize edildi — iskonto %${o.iskontoOrani}`, renk: "text-violet-700" },
                  onay: { ad: "Onaylandı", renk: "text-emerald-700" },
                  ret: { ad: "Reddedildi", renk: "text-red-600" },
                }[o.tip] ?? { ad: o.tip, renk: "text-slate-600" };
                return (
                  <li key={i} className="relative text-xs">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-slate-300" />
                    <span className={`font-medium ${etiket.renk}`}>{etiket.ad}</span>{" "}
                    <span className="text-slate-500">
                      · {para.format(o.toplam)} · {o.kullaniciAd} ·{" "}
                      {new Date(o.zaman).toLocaleString("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    {o.aciklama && <p className="text-slate-400">{o.aciklama}</p>}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {islemHata && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{islemHata}</p>
        )}
      </div>
    </Modal>
  );
}
