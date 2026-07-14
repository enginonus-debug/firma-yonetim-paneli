"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Handshake,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import Modal from "@/components/Modal";
import Sayfalama from "@/components/Sayfalama";
import { etiketSinifi, girdiSinifi, para, tarihGoster } from "@/lib/format";
import { ULKELER, ulkeBul } from "@/lib/ulkeler";

type Musteri = {
  id: number;
  ad: string;
  telefon: string | null;
  ulkeKodu: string;
  email: string | null;
  adres: string | null;
  vergiNo: string | null;
  yetkiliAd: string | null;
  yetkiliUnvan: string | null;
  yetkiliTelefon: string | null;
  yetkiliEmail: string | null;
  notlar: string | null;
  _count: { satisFirsatlari: number; tahsilatlar: number };
};

type Firsat = {
  id: number;
  baslik: string | null;
  durum: string;
  tutar: string | null;
  tarih: string | null;
  kayipNedeni: string | null;
  musteriId: number;
  sorumluId: number | null;
  musteri: { id: number; ad: string };
  sorumlu: { id: number; adSoyad: string } | null;
};

type MusteriForm = {
  ad: string;
  ulkeKodu: string;
  telefon: string;
  email: string;
  adres: string;
  vergiNo: string;
  yetkiliAd: string;
  yetkiliUnvan: string;
  yetkiliTelefon: string;
  yetkiliEmail: string;
  notlar: string;
};
type FirsatForm = {
  musteriId: string;
  baslik: string;
  sorumluId: string;
  durum: string;
  tutar: string;
  tarih: string;
  kayipNedeni: string;
};

const bosMusteriForm: MusteriForm = {
  ad: "",
  ulkeKodu: "+90",
  telefon: "",
  email: "",
  adres: "",
  vergiNo: "",
  yetkiliAd: "",
  yetkiliUnvan: "",
  yetkiliTelefon: "",
  yetkiliEmail: "",
  notlar: "",
};
const bosFirsatForm: FirsatForm = {
  musteriId: "",
  baslik: "",
  sorumluId: "",
  durum: "potansiyel",
  tutar: "",
  tarih: "",
  kayipNedeni: "",
};

const firsatDurumlari = [
  { deger: "potansiyel", etiket: "Potansiyel", sinif: "bg-slate-100 text-slate-600" },
  { deger: "gorusuluyor", etiket: "Görüşülüyor", sinif: "bg-sky-100 text-sky-700" },
  { deger: "kazanildi", etiket: "Kazanıldı", sinif: "bg-emerald-100 text-emerald-700" },
  { deger: "kaybedildi", etiket: "Kaybedildi", sinif: "bg-red-100 text-red-600" },
];

const LIMIT = 20;

// Seçili ülkenin izin verdiği azami haneye kadar yalnızca rakam bırakır.
// Türkiye'de (+90) başında 0 varsa atılır (10 hane, ör. 5321234567).
function telefonDuzelt(v: string, ulkeKodu: string) {
  let rakam = v.replace(/\D/g, "");
  if (ulkeKodu === "+90") rakam = rakam.replace(/^0+/, "");
  const maks = ulkeBul(ulkeKodu)?.max ?? 15;
  return rakam.slice(0, maks);
}

function telefonIpucu(ulkeKodu: string) {
  const u = ulkeBul(ulkeKodu);
  if (!u) return "";
  const aralik = u.min === u.max ? `${u.min}` : `${u.min}-${u.max}`;
  return ulkeKodu === "+90"
    ? "Başında 0 olmadan 10 haneli"
    : `${u.ad} için ${aralik} haneli`;
}

export default function MusterilerSayfasi() {
  const [sekme, setSekme] = useState<"musteriler" | "firsatlar">("musteriler");
  const [hata, setHata] = useState("");

  // ---- Müşteriler sekmesi ----
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [arama, setArama] = useState("");
  const [mSayfa, setMSayfa] = useState(1);
  const [mToplam, setMToplam] = useState(0);
  const [mYukleniyor, setMYukleniyor] = useState(true);
  const [musteriForm, setMusteriForm] = useState<MusteriForm | null>(null);
  const [duzenlenenMusteri, setDuzenlenenMusteri] = useState<Musteri | null>(null);

  // ---- Fırsatlar sekmesi ----
  const [firsatlar, setFirsatlar] = useState<Firsat[]>([]);
  const [fDurum, setFDurum] = useState("");
  const [fSayfa, setFSayfa] = useState(1);
  const [fToplam, setFToplam] = useState(0);
  const [fYukleniyor, setFYukleniyor] = useState(false);
  const [firsatForm, setFirsatForm] = useState<FirsatForm | null>(null);
  const [duzenlenenFirsat, setDuzenlenenFirsat] = useState<Firsat | null>(null);

  // Modal seçenekleri
  const [musteriSecenekleri, setMusteriSecenekleri] = useState<{ id: number; ad: string }[]>([]);
  const [calisanSecenekleri, setCalisanSecenekleri] = useState<{ id: number; adSoyad: string }[]>([]);

  const [formHata, setFormHata] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const musterileriYukle = useCallback(async () => {
    setMYukleniyor(true);
    setHata("");
    try {
      const p = new URLSearchParams({ sayfa: String(mSayfa), limit: String(LIMIT) });
      if (arama.trim()) p.set("arama", arama.trim());
      const yanit = await fetch(`/api/musteriler?${p}`);
      if (!yanit.ok) throw new Error();
      const j = await yanit.json();
      setMusteriler(j.veriler);
      setMToplam(j.toplam);
    } catch {
      setHata("Müşteriler yüklenemedi");
    } finally {
      setMYukleniyor(false);
    }
  }, [mSayfa, arama]);

  const firsatlariYukle = useCallback(async () => {
    setFYukleniyor(true);
    setHata("");
    try {
      const p = new URLSearchParams({ sayfa: String(fSayfa), limit: String(LIMIT) });
      if (fDurum) p.set("durum", fDurum);
      const yanit = await fetch(`/api/satis-firsatlari?${p}`);
      if (!yanit.ok) throw new Error();
      const j = await yanit.json();
      setFirsatlar(j.veriler);
      setFToplam(j.toplam);
    } catch {
      setHata("Satış fırsatları yüklenemedi");
    } finally {
      setFYukleniyor(false);
    }
  }, [fSayfa, fDurum]);

  // Arama yazarken 400ms bekleyip yükle
  useEffect(() => {
    if (sekme !== "musteriler") return;
    const zamanlayici = setTimeout(musterileriYukle, arama ? 400 : 0);
    return () => clearTimeout(zamanlayici);
  }, [sekme, musterileriYukle, arama]);

  useEffect(() => {
    if (sekme === "firsatlar") firsatlariYukle();
  }, [sekme, firsatlariYukle]);

  // Fırsat modalı için müşteri + çalışan listeleri (ilk açılışta bir kez)
  async function secenekleriYukle() {
    if (musteriSecenekleri.length === 0) {
      const yanit = await fetch("/api/musteriler?limit=100");
      if (yanit.ok) {
        const j = await yanit.json();
        setMusteriSecenekleri(j.veriler.map((m: Musteri) => ({ id: m.id, ad: m.ad })));
      }
    }
    if (calisanSecenekleri.length === 0) {
      const yanit = await fetch("/api/calisanlar?aktif=true");
      if (yanit.ok) setCalisanSecenekleri(await yanit.json());
    }
  }

  // ---- Müşteri işlemleri ----
  function musteriAc(m?: Musteri) {
    setDuzenlenenMusteri(m ?? null);
    setMusteriForm(
      m
        ? {
            ad: m.ad,
            ulkeKodu: m.ulkeKodu ?? "+90",
            telefon: m.telefon ?? "",
            email: m.email ?? "",
            adres: m.adres ?? "",
            vergiNo: m.vergiNo ?? "",
            yetkiliAd: m.yetkiliAd ?? "",
            yetkiliUnvan: m.yetkiliUnvan ?? "",
            yetkiliTelefon: m.yetkiliTelefon ?? "",
            yetkiliEmail: m.yetkiliEmail ?? "",
            notlar: m.notlar ?? "",
          }
        : bosMusteriForm
    );
    setFormHata("");
  }

  async function musteriKaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!musteriForm) return;
    setKaydediliyor(true);
    setFormHata("");

    const govde = {
      ad: musteriForm.ad.trim(),
      ulkeKodu: musteriForm.ulkeKodu,
      telefon: musteriForm.telefon.replace(/\D/g, "") || null,
      email: musteriForm.email.trim() || null,
      adres: musteriForm.adres.trim() || null,
      vergiNo: musteriForm.vergiNo.replace(/\D/g, "") || null,
      yetkiliAd: musteriForm.yetkiliAd.trim() || null,
      yetkiliUnvan: musteriForm.yetkiliUnvan.trim() || null,
      yetkiliTelefon: musteriForm.yetkiliTelefon.replace(/\D/g, "") || null,
      yetkiliEmail: musteriForm.yetkiliEmail.trim() || null,
      notlar: musteriForm.notlar.trim() || null,
    };

    try {
      const yanit = await fetch(
        duzenlenenMusteri ? `/api/musteriler/${duzenlenenMusteri.id}` : "/api/musteriler",
        {
          method: duzenlenenMusteri ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(govde),
        }
      );
      if (!yanit.ok) {
        const j = await yanit.json().catch(() => null);
        setFormHata(j?.hata ?? "Kayıt başarısız oldu");
        return;
      }
      setMusteriForm(null);
      setMusteriSecenekleri([]); // seçenek önbelleğini tazele
      musterileriYukle();
    } catch {
      setFormHata("Sunucuya ulaşılamadı");
    } finally {
      setKaydediliyor(false);
    }
  }

  async function musteriSil(m: Musteri) {
    if (!window.confirm(`"${m.ad}" silinsin mi?`)) return;
    const yanit = await fetch(`/api/musteriler/${m.id}`, { method: "DELETE" });
    if (yanit.ok) {
      setMusteriSecenekleri([]);
      musterileriYukle();
    } else {
      const j = await yanit.json().catch(() => null);
      setHata(j?.hata ?? "Silme başarısız oldu");
    }
  }

  // ---- Fırsat işlemleri ----
  function firsatAc(f?: Firsat) {
    secenekleriYukle();
    setDuzenlenenFirsat(f ?? null);
    setFirsatForm(
      f
        ? {
            musteriId: String(f.musteriId),
            baslik: f.baslik ?? "",
            sorumluId: f.sorumluId ? String(f.sorumluId) : "",
            durum: f.durum,
            tutar: f.tutar ? String(Number(f.tutar)) : "",
            tarih: f.tarih?.slice(0, 10) ?? "",
            kayipNedeni: f.kayipNedeni ?? "",
          }
        : bosFirsatForm
    );
    setFormHata("");
  }

  async function firsatKaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!firsatForm) return;
    setKaydediliyor(true);
    setFormHata("");

    const govde = {
      musteriId: Number(firsatForm.musteriId),
      baslik: firsatForm.baslik.trim() || null,
      sorumluId: firsatForm.sorumluId ? Number(firsatForm.sorumluId) : null,
      durum: firsatForm.durum,
      tutar: firsatForm.tutar ? Number(firsatForm.tutar) : null,
      tarih: firsatForm.tarih || null,
      kayipNedeni:
        firsatForm.durum === "kaybedildi" ? firsatForm.kayipNedeni.trim() || null : null,
    };

    try {
      const yanit = await fetch(
        duzenlenenFirsat
          ? `/api/satis-firsatlari/${duzenlenenFirsat.id}`
          : "/api/satis-firsatlari",
        {
          method: duzenlenenFirsat ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(govde),
        }
      );
      if (!yanit.ok) {
        const j = await yanit.json().catch(() => null);
        setFormHata(j?.hata ?? "Kayıt başarısız oldu");
        return;
      }
      setFirsatForm(null);
      firsatlariYukle();
    } catch {
      setFormHata("Sunucuya ulaşılamadı");
    } finally {
      setKaydediliyor(false);
    }
  }

  async function firsatDurumGuncelle(f: Firsat, durum: string) {
    let kayipNedeni: string | null = null;
    if (durum === "kaybedildi") {
      const neden = window.prompt(
        "Fırsat neden olumsuz sonuçlandı? (satışçı açıklaması zorunlu)",
        f.kayipNedeni ?? ""
      );
      if (neden === null) return; // vazgeçildi
      if (!neden.trim()) {
        setHata("Kaybedilen fırsat için neden zorunlu");
        return;
      }
      kayipNedeni = neden.trim();
    }
    const yanit = await fetch(`/api/satis-firsatlari/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum, kayipNedeni }),
    });
    if (yanit.ok) firsatlariYukle();
    else {
      const j = await yanit.json().catch(() => null);
      setHata(j?.hata ?? "Durum güncellenemedi");
    }
  }

  async function firsatSil(f: Firsat) {
    if (!window.confirm(`"${f.baslik ?? f.musteri.ad}" fırsatı silinsin mi?`)) return;
    const yanit = await fetch(`/api/satis-firsatlari/${f.id}`, { method: "DELETE" });
    if (yanit.ok) firsatlariYukle();
    else {
      const j = await yanit.json().catch(() => null);
      setHata(j?.hata ?? "Silme başarısız oldu");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Müşteriler & Satış</h1>
          <p className="mt-1 text-sm text-slate-500">
            Müşteri kayıtları ve satış fırsatı takibi
          </p>
        </div>
        <button
          onClick={() => (sekme === "musteriler" ? musteriAc() : firsatAc())}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
        >
          <Plus size={17} />
          {sekme === "musteriler" ? "Yeni Müşteri" : "Yeni Fırsat"}
        </button>
      </div>

      <div className="mt-5 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        <button
          onClick={() => setSekme("musteriler")}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm transition-colors ${
            sekme === "musteriler"
              ? "bg-slate-900 font-medium text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users size={15} />
          Müşteriler
        </button>
        <button
          onClick={() => setSekme("firsatlar")}
          className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm transition-colors ${
            sekme === "firsatlar"
              ? "bg-slate-900 font-medium text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Handshake size={15} />
          Satış Fırsatları
        </button>
      </div>

      {hata && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{hata}</p>
      )}

      {sekme === "musteriler" ? (
        <>
          <div className="relative mt-4 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={arama}
              onChange={(e) => {
                setArama(e.target.value);
                setMSayfa(1);
              }}
              placeholder="Ad, telefon, e-posta veya yetkili ile ara…"
              className={`${girdiSinifi} pl-9`}
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Müşteri</th>
                  <th className="px-4 py-3 font-medium">İletişim</th>
                  <th className="px-4 py-3 font-medium">Yetkili</th>
                  <th className="px-4 py-3 text-center font-medium">Fırsat</th>
                  <th className="px-4 py-3 text-center font-medium">Tahsilat</th>
                  <th className="px-4 py-3 text-right font-medium">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mYukleniyor ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : musteriler.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      {arama ? "Aramayla eşleşen müşteri yok." : "Henüz müşteri kaydı yok."}
                    </td>
                  </tr>
                ) : (
                  musteriler.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          {m.ad}
                          {m.notlar && (
                            <span
                              title={m.notlar}
                              className="inline-flex cursor-help text-amber-500"
                              aria-label="Firma notu var"
                            >
                              <StickyNote size={14} className="shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex flex-col text-xs">
                          <span>
                            {m.telefon
                              ? `${m.ulkeKodu !== "+90" ? m.ulkeKodu + " " : ""}${m.telefon}`
                              : "—"}
                          </span>
                          {m.email && <span className="text-slate-400">{m.email}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {m.yetkiliAd ? (
                          <div className="flex flex-col text-xs">
                            <span>
                              {m.yetkiliAd}
                              {m.yetkiliUnvan && (
                                <span className="text-slate-400"> · {m.yetkiliUnvan}</span>
                              )}
                            </span>
                            {m.yetkiliTelefon && (
                              <span className="text-slate-400">{m.yetkiliTelefon}</span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {m._count.satisFirsatlari}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {m._count.tahsilatlar}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => musteriAc(m)}
                            title="Düzenle"
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => musteriSil(m)}
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
            <Sayfalama sayfa={mSayfa} toplam={mToplam} limit={LIMIT} onDegis={setMSayfa} />
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {[{ deger: "", etiket: "Tümü" }, ...firsatDurumlari].map((f) => (
              <button
                key={f.deger}
                onClick={() => {
                  setFDurum(f.deger);
                  setFSayfa(1);
                }}
                className={`rounded-md px-3.5 py-1.5 text-sm transition-colors ${
                  fDurum === f.deger
                    ? "bg-slate-900 font-medium text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.etiket}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Fırsat</th>
                  <th className="px-4 py-3 font-medium">Müşteri</th>
                  <th className="px-4 py-3 font-medium">Sorumlu</th>
                  <th className="px-4 py-3 text-right font-medium">Tutar</th>
                  <th className="px-4 py-3 font-medium">Tarih</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                  <th className="px-4 py-3 text-right font-medium">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fYukleniyor ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : firsatlar.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  firsatlar.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {f.baslik ?? "—"}
                        {f.durum === "kaybedildi" && f.kayipNedeni && (
                          <span
                            className="ml-1 cursor-help text-xs text-red-400"
                            title={`Kayıp nedeni: ${f.kayipNedeni}`}
                          >
                            ⓘ
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{f.musteri.ad}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {f.sorumlu?.adSoyad ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {f.tutar ? para.format(Number(f.tutar)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{tarihGoster(f.tarih)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={f.durum}
                          onChange={(e) => firsatDurumGuncelle(f, e.target.value)}
                          className={`cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium outline-none ${
                            firsatDurumlari.find((d) => d.deger === f.durum)?.sinif ??
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {firsatDurumlari.map((d) => (
                            <option key={d.deger} value={d.deger}>
                              {d.etiket}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/teklifler?firsat=${f.id}`}
                            title="Fiyat teklifi hazırla"
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
                          >
                            <FileText size={16} />
                          </Link>
                          <button
                            onClick={() => firsatAc(f)}
                            title="Düzenle"
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => firsatSil(f)}
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
            <Sayfalama sayfa={fSayfa} toplam={fToplam} limit={LIMIT} onDegis={setFSayfa} />
          </div>
        </>
      )}

      {musteriForm && (
        <Modal
          baslik={duzenlenenMusteri ? "Müşteriyi Düzenle" : "Yeni Müşteri"}
          kapat={() => setMusteriForm(null)}
          genis
        >
          <form onSubmit={musteriKaydet} className="space-y-4">
            <div>
              <label htmlFor="mAd" className={etiketSinifi}>
                Müşteri Adı <span className="text-red-500">*</span>
              </label>
              <input
                id="mAd"
                required
                value={musteriForm.ad}
                onChange={(e) => setMusteriForm({ ...musteriForm, ad: e.target.value })}
                className={girdiSinifi}
                placeholder="Örn: Yıldız Mobilya Mağazası"
              />
            </div>
            <div>
              <label className={etiketSinifi}>Telefon</label>
              <div className="flex gap-2">
                <select
                  aria-label="Ülke kodu"
                  title="Ülke kodu"
                  value={musteriForm.ulkeKodu}
                  onChange={(e) =>
                    setMusteriForm({ ...musteriForm, ulkeKodu: e.target.value, telefon: "" })
                  }
                  className="w-24 shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {ULKELER.map((u) => (
                    <option key={u.kod} value={u.kod}>
                      {u.kod} {u.ad}
                    </option>
                  ))}
                </select>
                <input
                  id="mTelefon"
                  type="tel"
                  inputMode="numeric"
                  value={musteriForm.telefon}
                  onChange={(e) =>
                    setMusteriForm({
                      ...musteriForm,
                      telefon: telefonDuzelt(e.target.value, musteriForm.ulkeKodu),
                    })
                  }
                  className={`${girdiSinifi} min-w-0 flex-1`}
                  placeholder={musteriForm.ulkeKodu === "+90" ? "5xx xxx xx xx" : "Numara (rakam)"}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">{telefonIpucu(musteriForm.ulkeKodu)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mEmail" className={etiketSinifi}>
                  E-posta
                </label>
                <input
                  id="mEmail"
                  type="email"
                  value={musteriForm.email}
                  onChange={(e) => setMusteriForm({ ...musteriForm, email: e.target.value })}
                  className={girdiSinifi}
                  placeholder="info@firma.com"
                />
              </div>
              <div>
                <label htmlFor="mVergiNo" className={etiketSinifi}>
                  Vergi No
                </label>
                <input
                  id="mVergiNo"
                  inputMode="numeric"
                  maxLength={10}
                  value={musteriForm.vergiNo}
                  onChange={(e) =>
                    setMusteriForm({
                      ...musteriForm,
                      vergiNo: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  className={girdiSinifi}
                  placeholder="10 haneli"
                />
              </div>
            </div>
            <div>
              <label htmlFor="mAdres" className={etiketSinifi}>
                Adres
              </label>
              <input
                id="mAdres"
                value={musteriForm.adres}
                onChange={(e) => setMusteriForm({ ...musteriForm, adres: e.target.value })}
                className={girdiSinifi}
              />
            </div>

            {/* Yetkili / irtibat kişisi */}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <UserRound size={15} className="text-slate-400" />
                Yetkili İletişim Kişisi
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mYetkiliAd" className={etiketSinifi}>
                    Ad Soyad
                  </label>
                  <input
                    id="mYetkiliAd"
                    value={musteriForm.yetkiliAd}
                    onChange={(e) =>
                      setMusteriForm({ ...musteriForm, yetkiliAd: e.target.value })
                    }
                    className={girdiSinifi}
                    placeholder="Örn: Ali Vural"
                  />
                </div>
                <div>
                  <label htmlFor="mYetkiliUnvan" className={etiketSinifi}>
                    Ünvan / Görev
                  </label>
                  <input
                    id="mYetkiliUnvan"
                    value={musteriForm.yetkiliUnvan}
                    onChange={(e) =>
                      setMusteriForm({ ...musteriForm, yetkiliUnvan: e.target.value })
                    }
                    className={girdiSinifi}
                    placeholder="Örn: Satın Alma Müdürü"
                  />
                </div>
                <div>
                  <label htmlFor="mYetkiliTelefon" className={etiketSinifi}>
                    Telefon
                  </label>
                  <input
                    id="mYetkiliTelefon"
                    type="tel"
                    inputMode="numeric"
                    value={musteriForm.yetkiliTelefon}
                    onChange={(e) =>
                      setMusteriForm({
                        ...musteriForm,
                        yetkiliTelefon: telefonDuzelt(e.target.value, musteriForm.ulkeKodu),
                      })
                    }
                    className={girdiSinifi}
                    placeholder={musteriForm.ulkeKodu + " …"}
                  />
                </div>
                <div>
                  <label htmlFor="mYetkiliEmail" className={etiketSinifi}>
                    E-posta
                  </label>
                  <input
                    id="mYetkiliEmail"
                    type="email"
                    value={musteriForm.yetkiliEmail}
                    onChange={(e) =>
                      setMusteriForm({ ...musteriForm, yetkiliEmail: e.target.value })
                    }
                    className={girdiSinifi}
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="mNotlar" className={etiketSinifi}>
                Firma Hakkında Notlar
              </label>
              <textarea
                id="mNotlar"
                rows={3}
                value={musteriForm.notlar}
                onChange={(e) => setMusteriForm({ ...musteriForm, notlar: e.target.value })}
                className={girdiSinifi}
                placeholder="Ödeme alışkanlıkları, tercihleri, geçmiş, dikkat edilmesi gerekenler… Temsilci değişince yeni kişiye devredilecek önemli bilgiler."
              />
            </div>

            {formHata && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formHata}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMusteriForm(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={kaydediliyor}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
              >
                {kaydediliyor ? "Kaydediliyor…" : duzenlenenMusteri ? "Güncelle" : "Ekle"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {firsatForm && (
        <Modal
          baslik={duzenlenenFirsat ? "Fırsatı Düzenle" : "Yeni Satış Fırsatı"}
          kapat={() => setFirsatForm(null)}
          genis
        >
          <form onSubmit={firsatKaydet} className="space-y-4">
            <div>
              <label htmlFor="fMusteri" className={etiketSinifi}>
                Müşteri <span className="text-red-500">*</span>
              </label>
              <select
                id="fMusteri"
                required
                value={firsatForm.musteriId}
                onChange={(e) =>
                  setFirsatForm({ ...firsatForm, musteriId: e.target.value })
                }
                className={girdiSinifi}
              >
                <option value="">Seçin…</option>
                {musteriSecenekleri.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.ad}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fBaslik" className={etiketSinifi}>
                Başlık
              </label>
              <input
                id="fBaslik"
                value={firsatForm.baslik}
                onChange={(e) => setFirsatForm({ ...firsatForm, baslik: e.target.value })}
                className={girdiSinifi}
                placeholder="Örn: 50 adet yemek masası"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fSorumlu" className={etiketSinifi}>
                  Sorumlu
                </label>
                <select
                  id="fSorumlu"
                  value={firsatForm.sorumluId}
                  onChange={(e) =>
                    setFirsatForm({ ...firsatForm, sorumluId: e.target.value })
                  }
                  className={girdiSinifi}
                >
                  <option value="">Atanmadı</option>
                  {calisanSecenekleri.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.adSoyad}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="fDurum" className={etiketSinifi}>
                  Durum
                </label>
                <select
                  id="fDurum"
                  value={firsatForm.durum}
                  onChange={(e) => setFirsatForm({ ...firsatForm, durum: e.target.value })}
                  className={girdiSinifi}
                >
                  {firsatDurumlari.map((d) => (
                    <option key={d.deger} value={d.deger}>
                      {d.etiket}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fTutar" className={etiketSinifi}>
                  Tutar (₺)
                </label>
                <input
                  id="fTutar"
                  type="number"
                  min="0"
                  step="0.01"
                  value={firsatForm.tutar}
                  onChange={(e) => setFirsatForm({ ...firsatForm, tutar: e.target.value })}
                  className={girdiSinifi}
                />
              </div>
              <div>
                <label htmlFor="fTarih" className={etiketSinifi}>
                  Tarih
                </label>
                <input
                  id="fTarih"
                  type="date"
                  value={firsatForm.tarih}
                  onChange={(e) => setFirsatForm({ ...firsatForm, tarih: e.target.value })}
                  className={girdiSinifi}
                />
              </div>
            </div>

            {firsatForm.durum === "kaybedildi" && (
              <div>
                <label htmlFor="fKayipNedeni" className={etiketSinifi}>
                  Olumsuz Sonuç Nedeni <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="fKayipNedeni"
                  rows={2}
                  required
                  value={firsatForm.kayipNedeni}
                  onChange={(e) =>
                    setFirsatForm({ ...firsatForm, kayipNedeni: e.target.value })
                  }
                  className={girdiSinifi}
                  placeholder="Fırsatın neden kaybedildiğini açıklayın (fiyat, rakip, zamanlama…)"
                />
              </div>
            )}

            {formHata && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formHata}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFirsatForm(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={kaydediliyor}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
              >
                {kaydediliyor ? "Kaydediliyor…" : duzenlenenFirsat ? "Güncelle" : "Ekle"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
