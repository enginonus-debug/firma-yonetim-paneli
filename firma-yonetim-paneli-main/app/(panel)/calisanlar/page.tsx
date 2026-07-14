"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Accessibility,
  Eye,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import Modal from "@/components/Modal";
import IzinMatrisi, { bosIzinler, type IzinlerFormu } from "@/components/IzinMatrisi";
import TopluCalisanEkle from "@/components/TopluCalisanEkle";
import { TR_ILLER, IL_ADLARI } from "@/lib/tr-iller";

// Liste yalnızca genel bilgileri içerir; özel bilgiler parola ile detaydan alınır
type Calisan = {
  id: number;
  adSoyad: string;
  pozisyon: string | null;
  telefon: string | null;
  iseBaslama: string | null;
  istenAyrilma: string | null;
  engelli: boolean;
  aktif: boolean;
  bugunDogumGunu: boolean;
  bugunYilDonumu: boolean;
  izinHakki: number | null; // birikimli toplam hak
  guncelYilHakki: number | null; // bu yılın hakkı
  kullanilanIzin: number;
  kalanIzin: number | null;
  // Bağlı panel hesabı: null = yok, "bekliyor" = admin onayı bekliyor, "var" = atanmış
  kullaniciDurumu: "var" | "bekliyor" | null;
  kullaniciAdi: string | null;
};

type CalisanDetay = Calisan & {
  tcKimlikNo: string | null;
  dogumTarihi: string | null;
  cinsiyet: string | null;
  il: string | null;
  ilce: string | null;
  adres: string | null;
  acilTelefon: string | null;
  maas: string | null; // Prisma Decimal JSON'da string gelir
  engelDurumu: string | null;
  foto: string | null;
};

type FormVerisi = {
  adSoyad: string;
  tcKimlikNo: string;
  dogumTarihi: string;
  cinsiyet: string; // erkek | kadin | ""
  pozisyon: string;
  telefon: string;
  il: string;
  ilce: string;
  adres: string;
  acilTelefon: string;
  iseBaslama: string; // YYYY-MM-DD
  istenAyrilma: string;
  maas: string;
  engelli: boolean;
  engelDurumu: string;
  foto: string; // data-URL veya boş
};

const bosForm: FormVerisi = {
  adSoyad: "",
  tcKimlikNo: "",
  dogumTarihi: "",
  cinsiyet: "",
  pozisyon: "",
  telefon: "",
  il: "",
  ilce: "",
  adres: "",
  acilTelefon: "",
  iseBaslama: "",
  istenAyrilma: "",
  maas: "",
  engelli: false,
  engelDurumu: "",
  foto: "",
};

const filtreler = [
  { deger: "true", etiket: "Aktif" },
  { deger: "false", etiket: "Pasif" },
  { deger: "", etiket: "Tümü" },
] as const;

const girdiSinifi =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

function tarihGoster(t: string | null) {
  return t ? new Date(t).toLocaleDateString("tr-TR") : "—";
}

function maasGoster(m: string | null) {
  if (m === null) return "—";
  const sayi = Number(m);
  if (Number.isNaN(sayi)) return "—";
  return `₺${sayi.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}

function bugunStr() {
  return new Date().toISOString().slice(0, 10);
}

// Başında 0 olmadan en fazla 10 rakam bırakır (ör: 5321234567)
function telefonDuzelt(v: string) {
  return v.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10);
}

// Seçilen fotoğrafı en fazla 400px olacak şekilde küçültüp data-URL döndürür
async function fotoOku(dosya: File): Promise<string> {
  const url = URL.createObjectURL(dosya);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Görsel okunamadı"));
      img.src = url;
    });
    const oran = Math.min(1, 400 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * oran));
    canvas.height = Math.max(1, Math.round(img.height * oran));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function CalisanlarSayfasi() {
  const [calisanlar, setCalisanlar] = useState<Calisan[]>([]);
  const [filtre, setFiltre] = useState<string>("true");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [adminMi, setAdminMi] = useState(false);

  // Form durumu: null = kapalı; duzenlenen null = yeni kayıt
  const [form, setForm] = useState<FormVerisi | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<Calisan | null>(null);
  const [formHata, setFormHata] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // Pasife alma onayı: seçili çalışan + ayrılma tarihi
  const [pasifeAlinan, setPasifeAlinan] = useState<Calisan | null>(null);
  const [ayrilmaTarihi, setAyrilmaTarihi] = useState("");
  const [pasifHata, setPasifHata] = useState("");

  // Kullanıcı olarak atama: seçili çalışan (hesap admin onayına düşer)
  const [kullaniciAtanan, setKullaniciAtanan] = useState<Calisan | null>(null);

  // Toplu (Excel) ekleme modalı
  const [topluAcik, setTopluAcik] = useState(false);

  // Detay (özel bilgiler): parola doğrulanana kadar veri null kalır
  const [detayCalisan, setDetayCalisan] = useState<Calisan | null>(null);
  const [detayVeri, setDetayVeri] = useState<CalisanDetay | null>(null);
  const [parola, setParola] = useState("");
  const [detayHata, setDetayHata] = useState("");
  const [detayYukleniyor, setDetayYukleniyor] = useState(false);

  const yukle = useCallback(async () => {
    setHata("");
    try {
      const yanit = await fetch(`/api/calisanlar${filtre ? `?aktif=${filtre}` : ""}`);
      if (!yanit.ok) throw new Error();
      setCalisanlar(await yanit.json());
    } catch {
      setHata("Çalışanlar yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, [filtre]);

  useEffect(() => {
    setYukleniyor(true);
    yukle();
  }, [yukle]);

  // Kalıcı silme yalnızca admine görünür
  useEffect(() => {
    fetch("/api/hesap")
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => setAdminMi(h?.rol === "admin"))
      .catch(() => {});
  }, []);

  function yeniAc() {
    setDuzenlenen(null);
    setForm(bosForm);
    setFormHata("");
  }

  // Pasif çalışanı kalıcı olarak siler (admin)
  async function kaliciSil(c: Calisan) {
    if (
      !window.confirm(
        `"${c.adSoyad}" KALICI olarak silinsin mi?\n\nBu işlem geri alınamaz; çalışanın devam (puantaj) kayıtları da silinir, makine/satış sorumluluğu ve bağlı hesap bağlantısı kaldırılır.`
      )
    )
      return;
    const yanit = await fetch(`/api/calisanlar/${c.id}/kalici`, { method: "DELETE" });
    if (yanit.ok) yukle();
    else {
      const j = await yanit.json().catch(() => null);
      setHata(j?.hata ?? "Kalıcı silme başarısız oldu");
    }
  }

  // Düzenleme için özel alanlar listede olmadığından tam kaydı çeker
  async function duzenleAc(c: Calisan) {
    setHata("");
    try {
      const yanit = await fetch(`/api/calisanlar/${c.id}`);
      if (!yanit.ok) throw new Error();
      const tam: CalisanDetay = await yanit.json();
      setDuzenlenen(c);
      setForm({
        adSoyad: tam.adSoyad,
        tcKimlikNo: tam.tcKimlikNo ?? "",
        dogumTarihi: tam.dogumTarihi?.slice(0, 10) ?? "",
        cinsiyet: tam.cinsiyet ?? "",
        pozisyon: tam.pozisyon ?? "",
        telefon: tam.telefon ?? "",
        il: tam.il ?? "",
        ilce: tam.ilce ?? "",
        adres: tam.adres ?? "",
        acilTelefon: tam.acilTelefon ?? "",
        iseBaslama: tam.iseBaslama?.slice(0, 10) ?? "",
        istenAyrilma: tam.istenAyrilma?.slice(0, 10) ?? "",
        maas: tam.maas ?? "",
        engelli: tam.engelli,
        engelDurumu: tam.engelDurumu ?? "",
        foto: tam.foto ?? "",
      });
      setFormHata("");
    } catch {
      setHata("Çalışan bilgileri alınamadı");
    }
  }

  function kapat() {
    setForm(null);
    setDuzenlenen(null);
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    if (form.engelli && !form.engelDurumu.trim()) {
      setFormHata("Engelli çalışan için engel durum bilgisi zorunlu");
      return;
    }
    if (!form.cinsiyet) {
      setFormHata("Cinsiyet seçimi zorunlu");
      return;
    }
    if (!form.il || !form.ilce) {
      setFormHata("İl ve ilçe seçimi zorunlu");
      return;
    }
    if (form.iseBaslama && form.iseBaslama > bugunStr()) {
      setFormHata("İşe başlama tarihi bugünden ileri bir tarih olamaz");
      return;
    }

    setKaydediliyor(true);
    setFormHata("");

    const govde = {
      adSoyad: form.adSoyad.trim(),
      tcKimlikNo: form.tcKimlikNo.trim(),
      dogumTarihi: form.dogumTarihi,
      cinsiyet: form.cinsiyet,
      pozisyon: form.pozisyon.trim(),
      telefon: form.telefon.trim(),
      il: form.il,
      ilce: form.ilce,
      adres: form.adres.trim(),
      acilTelefon: form.acilTelefon.trim(),
      iseBaslama: form.iseBaslama,
      maas: form.maas === "" ? null : Number(form.maas),
      engelli: form.engelli,
      engelDurumu: form.engelli ? form.engelDurumu.trim() : null,
      foto: form.foto || null,
      // Pasif çalışan düzenlenirken ayrılma tarihi de güncellenebilir
      ...(duzenlenen && !duzenlenen.aktif
        ? { istenAyrilma: form.istenAyrilma || null }
        : {}),
    };

    try {
      const yanit = await fetch(
        duzenlenen ? `/api/calisanlar/${duzenlenen.id}` : "/api/calisanlar",
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

  function pasifeAlAc(c: Calisan) {
    setPasifeAlinan(c);
    setAyrilmaTarihi(bugunStr());
    setPasifHata("");
  }

  async function pasifeAl(e: React.FormEvent) {
    e.preventDefault();
    if (!pasifeAlinan) return;
    if (!ayrilmaTarihi) {
      setPasifHata("İşten ayrılma tarihi zorunlu");
      return;
    }

    const yanit = await fetch(`/api/calisanlar/${pasifeAlinan.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ istenAyrilma: ayrilmaTarihi }),
    });

    if (yanit.ok) {
      setPasifeAlinan(null);
      yukle();
    } else {
      const j = await yanit.json().catch(() => null);
      setPasifHata(j?.hata ?? "İşlem başarısız oldu");
    }
  }

  async function aktiflestir(c: Calisan) {
    const yanit = await fetch(`/api/calisanlar/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktif: true, istenAyrilma: null }),
    });
    if (yanit.ok) yukle();
    else setHata("İşlem başarısız oldu");
  }

  function detayAc(c: Calisan) {
    setDetayCalisan(c);
    setDetayVeri(null);
    setParola("");
    setDetayHata("");
  }

  function detayKapat() {
    setDetayCalisan(null);
    setDetayVeri(null);
    setParola("");
    setDetayHata("");
  }

  async function detayGetir(e: React.FormEvent) {
    e.preventDefault();
    if (!detayCalisan) return;
    setDetayYukleniyor(true);
    setDetayHata("");

    try {
      const yanit = await fetch(`/api/calisanlar/${detayCalisan.id}/detay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parola }),
      });
      if (!yanit.ok) {
        const j = await yanit.json().catch(() => null);
        setDetayHata(j?.hata ?? "Bilgiler alınamadı");
        return;
      }
      setDetayVeri(await yanit.json());
    } catch {
      setDetayHata("Sunucuya ulaşılamadı");
    } finally {
      setDetayYukleniyor(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Çalışanlar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Çalışan ekleyin, düzenleyin veya pasife alın
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
            Yeni Çalışan
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
              <th className="px-4 py-3 font-medium">Ad Soyad</th>
              <th className="px-4 py-3 font-medium">Pozisyon</th>
              <th className="px-4 py-3 font-medium">Telefon</th>
              <th className="px-4 py-3 font-medium">İşe Başlama</th>
              <th className="px-4 py-3 font-medium">Yıllık İzin</th>
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
            ) : calisanlar.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  {filtre === "true"
                    ? "Aktif çalışan yok. Sağ üstten yeni çalışan ekleyebilirsiniz."
                    : "Kayıt bulunamadı."}
                </td>
              </tr>
            ) : (
              calisanlar.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {c.adSoyad}
                      {c.engelli && (
                        <Accessibility
                          size={16}
                          className="shrink-0 text-sky-600"
                          aria-label="Engelli çalışan"
                        />
                      )}
                      {c.bugunDogumGunu && (
                        <span
                          title="Bugün doğum günü!"
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                        >
                          🎂 Doğum Günü
                        </span>
                      )}
                      {c.bugunYilDonumu && (
                        <span
                          title="Bugün işe giriş yıl dönümü!"
                          className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700"
                        >
                          🎉 Yıl Dönümü
                        </span>
                      )}
                      {c.kullaniciDurumu === "var" && (
                        <span
                          title={`Panel kullanıcısı: ${c.kullaniciAdi}`}
                          className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
                        >
                          Kullanıcı
                        </span>
                      )}
                      {c.kullaniciDurumu === "bekliyor" && (
                        <span
                          title={`Kullanıcı talebi admin onayı bekliyor: ${c.kullaniciAdi}`}
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                        >
                          Onay Bekliyor
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.pozisyon ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.telefon ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{tarihGoster(c.iseBaslama)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.izinHakki === null ? (
                      <span title="İşe başlama tarihi girilmediği için hesaplanamıyor">—</span>
                    ) : c.izinHakki === 0 ? (
                      <span title="1 yılını doldurmadığı için henüz izin hakkı doğmadı">
                        Hak doğmadı
                      </span>
                    ) : (
                      <span
                        title={`Toplam hak (tüm hizmet süresi): ${c.izinHakki} gün · Bu yılın hakkı: ${c.guncelYilHakki} gün · Kullanılan (izinli): ${c.kullanilanIzin} gün · Kalan: ${c.kalanIzin} gün`}
                        className={c.kalanIzin !== null && c.kalanIzin < 0 ? "text-red-600" : ""}
                      >
                        {c.kalanIzin} / {c.izinHakki} gün
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.aktif
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {c.aktif ? "Aktif" : "Pasif"}
                    </span>
                    {!c.aktif && c.istenAyrilma && (
                      <p className="mt-1 text-xs text-slate-500">
                        Ayrılış: {tarihGoster(c.istenAyrilma)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => detayAc(c)}
                        title="Detaylı bilgi (parola gerekir)"
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => duzenleAc(c)}
                        title="Düzenle"
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Pencil size={16} />
                      </button>
                      {c.aktif && c.kullaniciDurumu === null && (
                        <button
                          onClick={() => setKullaniciAtanan(c)}
                          title="Kullanıcı olarak ata (admin onayı gerekir)"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-sky-50 hover:text-sky-600"
                        >
                          <UserPlus size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => (c.aktif ? pasifeAlAc(c) : aktiflestir(c))}
                        title={c.aktif ? "Pasife al" : "Aktifleştir"}
                        className={`rounded-lg p-2 transition-colors ${
                          c.aktif
                            ? "text-slate-500 hover:bg-red-50 hover:text-red-600"
                            : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                        }`}
                      >
                        {c.aktif ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      {!c.aktif && adminMi && (
                        <button
                          onClick={() => kaliciSil(c)}
                          title="Kalıcı olarak sil (geri alınamaz)"
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">

            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {duzenlenen ? "Çalışanı Düzenle" : "Yeni Çalışan"}
              </h2>
              <button
                onClick={kapat}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={kaydet} className="space-y-4">
              <div>
                <label htmlFor="adSoyad" className="mb-1 block text-sm font-medium text-slate-700">
                  Ad Soyad <span className="text-red-500">*</span>
                </label>
                <input
                  id="adSoyad"
                  required
                  value={form.adSoyad}
                  onChange={(e) => setForm({ ...form, adSoyad: e.target.value })}
                  className={girdiSinifi}
                  placeholder="Örn: Ahmet Yılmaz"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tcKimlikNo" className="mb-1 block text-sm font-medium text-slate-700">
                    TC Kimlik No <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tcKimlikNo"
                    required
                    inputMode="numeric"
                    maxLength={11}
                    pattern="\d{11}"
                    title="11 haneli rakam"
                    value={form.tcKimlikNo}
                    onChange={(e) =>
                      setForm({ ...form, tcKimlikNo: e.target.value.replace(/\D/g, "") })
                    }
                    className={girdiSinifi}
                    placeholder="11 haneli"
                  />
                </div>
                <div>
                  <label htmlFor="dogumTarihi" className="mb-1 block text-sm font-medium text-slate-700">
                    Doğum Tarihi <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="dogumTarihi"
                    type="date"
                    required
                    max={bugunStr()}
                    value={form.dogumTarihi}
                    onChange={(e) => setForm({ ...form, dogumTarihi: e.target.value })}
                    className={girdiSinifi}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Cinsiyet <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {[
                    { deger: "erkek", etiket: "Erkek" },
                    { deger: "kadin", etiket: "Kadın" },
                  ].map((c) => (
                    <button
                      key={c.deger}
                      type="button"
                      onClick={() => setForm({ ...form, cinsiyet: c.deger })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        form.cinsiyet === c.deger
                          ? "border-sky-500 bg-sky-50 font-medium text-sky-700"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {c.etiket}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pozisyon" className="mb-1 block text-sm font-medium text-slate-700">
                    Pozisyon <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="pozisyon"
                    required
                    value={form.pozisyon}
                    onChange={(e) => setForm({ ...form, pozisyon: e.target.value })}
                    className={girdiSinifi}
                    placeholder="Örn: Usta, Montaj, Satış"
                  />
                </div>
                <div>
                  <label htmlFor="telefon" className="mb-1 block text-sm font-medium text-slate-700">
                    Telefon <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="telefon"
                    type="tel"
                    required
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[1-9][0-9]{9}"
                    title="Başında 0 olmadan 10 haneli"
                    value={form.telefon}
                    onChange={(e) =>
                      setForm({ ...form, telefon: telefonDuzelt(e.target.value) })
                    }
                    className={girdiSinifi}
                    placeholder="5xx xxx xx xx"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="il" className="mb-1 block text-sm font-medium text-slate-700">
                    İl <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="il"
                    required
                    value={form.il}
                    onChange={(e) => setForm({ ...form, il: e.target.value, ilce: "" })}
                    className={girdiSinifi}
                  >
                    <option value="">Seçin…</option>
                    {IL_ADLARI.map((il) => (
                      <option key={il} value={il}>
                        {il}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ilce" className="mb-1 block text-sm font-medium text-slate-700">
                    İlçe <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="ilce"
                    required
                    disabled={!form.il}
                    value={form.ilce}
                    onChange={(e) => setForm({ ...form, ilce: e.target.value })}
                    className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-400`}
                  >
                    <option value="">{form.il ? "Seçin…" : "Önce il seçin"}</option>
                    {(TR_ILLER[form.il] ?? []).map((ilce) => (
                      <option key={ilce} value={ilce}>
                        {ilce}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="adres" className="mb-1 block text-sm font-medium text-slate-700">
                  Açık Adres <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="adres"
                  required
                  rows={2}
                  value={form.adres}
                  onChange={(e) => setForm({ ...form, adres: e.target.value })}
                  className={girdiSinifi}
                  placeholder="Mahalle, sokak, no"
                />
              </div>

              <div>
                <label htmlFor="acilTelefon" className="mb-1 block text-sm font-medium text-slate-700">
                  Acil Durumda Aranacak Yakını (Tel) <span className="text-red-500">*</span>
                </label>
                <input
                  id="acilTelefon"
                  type="tel"
                  required
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[1-9][0-9]{9}"
                  title="Başında 0 olmadan 10 haneli"
                  value={form.acilTelefon}
                  onChange={(e) =>
                    setForm({ ...form, acilTelefon: telefonDuzelt(e.target.value) })
                  }
                  className={girdiSinifi}
                  placeholder="Ulaşılamaması halinde aranacak numara"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="iseBaslama" className="mb-1 block text-sm font-medium text-slate-700">
                    İşe Başlama <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="iseBaslama"
                    type="date"
                    required
                    max={bugunStr()}
                    value={form.iseBaslama}
                    onChange={(e) => setForm({ ...form, iseBaslama: e.target.value })}
                    className={girdiSinifi}
                  />
                </div>
                <div>
                  <label htmlFor="maas" className="mb-1 block text-sm font-medium text-slate-700">
                    Maaş (₺)
                  </label>
                  <input
                    id="maas"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.maas}
                    onChange={(e) => setForm({ ...form, maas: e.target.value })}
                    className={girdiSinifi}
                    placeholder="Örn: 35000"
                  />
                </div>
              </div>

              {duzenlenen && !duzenlenen.aktif && (
                <div>
                  <label
                    htmlFor="istenAyrilma"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    İşten Ayrılma <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="istenAyrilma"
                    type="date"
                    required
                    value={form.istenAyrilma}
                    onChange={(e) => setForm({ ...form, istenAyrilma: e.target.value })}
                    className={girdiSinifi}
                  />
                </div>
              )}

              <div>
                <label htmlFor="foto" className="mb-1 block text-sm font-medium text-slate-700">
                  Fotoğraf
                </label>
                <div className="flex items-center gap-3">
                  {form.foto ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.foto}
                        alt="Çalışan fotoğrafı önizleme"
                        className="h-14 w-14 shrink-0 rounded-full border border-slate-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, foto: "" })}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        Kaldır
                      </button>
                    </>
                  ) : (
                    <input
                      id="foto"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const dosya = e.target.files?.[0];
                        if (!dosya) return;
                        try {
                          setForm({ ...form, foto: await fotoOku(dosya) });
                        } catch {
                          setFormHata("Fotoğraf okunamadı, farklı bir görsel deneyin");
                        }
                      }}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-200"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Engelli çalışan</p>
                    <p className="text-xs text-slate-500">
                      {form.engelli ? "Engelli — durum bilgisi zorunlu" : "Engelsiz"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        engelli: !form.engelli,
                        engelDurumu: form.engelli ? "" : form.engelDurumu,
                      })
                    }
                    aria-pressed={form.engelli}
                    title={form.engelli ? "Engelli (işaretli)" : "Engelsiz"}
                    className={`rounded-full p-2.5 transition-colors ${
                      form.engelli
                        ? "bg-sky-600 text-white hover:bg-sky-700"
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    <Accessibility size={20} />
                  </button>
                </div>
                {form.engelli && (
                  <div className="mt-3">
                    <label
                      htmlFor="engelDurumu"
                      className="mb-1 block text-sm font-medium text-slate-700"
                    >
                      Engel Durum Bilgisi <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="engelDurumu"
                      required
                      value={form.engelDurumu}
                      onChange={(e) => setForm({ ...form, engelDurumu: e.target.value })}
                      className={girdiSinifi}
                      placeholder="Örn: %40 işitme engeli"
                    />
                  </div>
                )}
              </div>

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
          </div>
        </div>
      )}

      {pasifeAlinan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">

            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pasife Al</h2>
              <button
                onClick={() => setPasifeAlinan(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{pasifeAlinan.adSoyad}</span> pasife
              alınacak. İşten ayrılma tarihini girin.
            </p>

            <form onSubmit={pasifeAl} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="ayrilmaTarihi"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  İşten Ayrılma Tarihi <span className="text-red-500">*</span>
                </label>
                <input
                  id="ayrilmaTarihi"
                  type="date"
                  required
                  value={ayrilmaTarihi}
                  onChange={(e) => setAyrilmaTarihi(e.target.value)}
                  className={girdiSinifi}
                />
              </div>

              {pasifHata && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{pasifHata}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasifeAlinan(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Pasife Al
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {kullaniciAtanan && (
        <KullaniciAtaModal
          calisan={kullaniciAtanan}
          kapat={() => setKullaniciAtanan(null)}
          tamam={() => {
            setKullaniciAtanan(null);
            yukle();
          }}
        />
      )}

      {topluAcik && (
        <TopluCalisanEkle
          kapat={() => setTopluAcik(false)}
          tamam={(eklenen) => {
            setTopluAcik(false);
            setHata("");
            if (eklenen > 0) yukle();
          }}
        />
      )}

      {detayCalisan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">

            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {detayCalisan.adSoyad} — Detaylı Bilgi
              </h2>
              <button
                onClick={detayKapat}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {!detayVeri ? (
              <form onSubmit={detayGetir} className="space-y-4">
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <Lock size={15} className="shrink-0 text-slate-400" />
                  Özel bilgileri görüntülemek için parola girin.
                </p>
                <input
                  type="password"
                  required
                  autoFocus
                  value={parola}
                  onChange={(e) => setParola(e.target.value)}
                  className={girdiSinifi}
                  placeholder="Parola"
                  aria-label="Parola"
                />
                {detayHata && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                    {detayHata}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={detayKapat}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={detayYukleniyor}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
                  >
                    {detayYukleniyor ? "Kontrol ediliyor…" : "Görüntüle"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {detayVeri.foto && (
                  // Sabit boyutlu yuvarlak görsel: mizanpajı etkilemez
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detayVeri.foto}
                    alt={`${detayVeri.adSoyad} fotoğrafı`}
                    className="mx-auto mb-4 h-28 w-28 rounded-full border border-slate-200 object-cover shadow-sm"
                  />
                )}
                <dl className="divide-y divide-slate-100 text-sm">
                {[
                  ["TC Kimlik No", detayVeri.tcKimlikNo ?? "—"],
                  ["Doğum Tarihi", tarihGoster(detayVeri.dogumTarihi)],
                  ["Cinsiyet", detayVeri.cinsiyet === "erkek" ? "Erkek" : detayVeri.cinsiyet === "kadin" ? "Kadın" : "—"],
                  ["Maaş", maasGoster(detayVeri.maas)],
                  ["İl / İlçe", detayVeri.il ? `${detayVeri.il}${detayVeri.ilce ? " / " + detayVeri.ilce : ""}` : "—"],
                  ["Açık Adres", detayVeri.adres ?? "—"],
                  ["Acil Durumda Aranacak Yakını", detayVeri.acilTelefon ?? "—"],
                  ...(detayVeri.engelli
                    ? [["Engel Durumu", detayVeri.engelDurumu ?? "—"] as const]
                    : []),
                  ...(!detayVeri.aktif
                    ? [["İşten Ayrılma", tarihGoster(detayVeri.istenAyrilma)] as const]
                    : []),
                ].map(([etiket, deger]) => (
                  <div key={etiket} className="flex justify-between gap-4 py-2.5">
                    <dt className="shrink-0 font-medium text-slate-500">{etiket}</dt>
                    <dd className="text-right text-slate-800">{deger}</dd>
                  </div>
                ))}
                </dl>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Çalışanı panel kullanıcısı olarak atama formu. Yeni Kullanıcı formuyla aynı
// bilgiler istenir (ad soyad çalışandan gelir); hesap admin onayına düşer ve
// onaylanana kadar giriş yapamaz.
function KullaniciAtaModal({
  calisan,
  kapat,
  tamam,
}: {
  calisan: Calisan;
  kapat: () => void;
  tamam: () => void;
}) {
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [izinler, setIzinler] = useState<IzinlerFormu>({ ...bosIzinler });
  const [hata, setHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [talepIletildi, setTalepIletildi] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setGonderiliyor(true);
    setHata("");
    try {
      const y = await fetch(`/api/calisanlar/${calisan.id}/kullanici`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kullaniciAdi: kullaniciAdi.toLowerCase().trim(),
          sifre,
          izinler,
        }),
      });
      if (!y.ok) {
        setHata((await y.json().catch(() => null))?.hata ?? "Kaydetme başarısız oldu");
        return;
      }
      setTalepIletildi(true);
    } catch {
      setHata("Sunucuya ulaşılamadı");
    } finally {
      setGonderiliyor(false);
    }
  }

  if (talepIletildi) {
    return (
      <Modal baslik="Talep İletildi" kapat={tamam}>
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-800">{calisan.adSoyad}</span> için kullanıcı
          talebi oluşturuldu. Hesap, admin <span className="font-medium">Kullanıcılar</span>{" "}
          ekranından onaylayana kadar giriş yapamaz.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            onClick={tamam}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
          >
            Tamam
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal baslik={`Kullanıcı Olarak Ata: ${calisan.adSoyad}`} kapat={kapat} genis>
      <form onSubmit={gonder} className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Hesap oluşturulduktan sonra admin onayına düşer; onaylanana kadar giriş yapılamaz.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Kullanıcı Adı <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={kullaniciAdi}
              onChange={(e) => setKullaniciAdi(e.target.value)}
              className={girdiSinifi}
              placeholder="ör. ahmet.yilmaz"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Şifre <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="password"
              minLength={6}
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className={girdiSinifi}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Ekran İzinleri</label>
          <IzinMatrisi izinler={izinler} degistir={setIzinler} />
        </div>

        {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}

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
            disabled={gonderiliyor}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
          >
            {gonderiliyor ? "Gönderiliyor…" : "Onaya Gönder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
