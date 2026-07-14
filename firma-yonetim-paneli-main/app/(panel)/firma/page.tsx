"use client";

import { useEffect, useState } from "react";
import { Building2, Check, ImagePlus } from "lucide-react";
import { etiketSinifi, girdiSinifi } from "@/lib/format";

type FormVerisi = { ad: string; adres: string; telefon: string; vergiNo: string; logo: string };

const bosForm: FormVerisi = { ad: "", adres: "", telefon: "", vergiNo: "", logo: "" };

// Seçilen logoyu en fazla 500px olacak şekilde küçültüp PNG data-URL döndürür
// (PNG şeffaflığı korur; belge çıktılarında logo temiz görünür)
async function logoOku(dosya: File): Promise<string> {
  const url = URL.createObjectURL(dosya);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Görsel okunamadı"));
      img.src = url;
    });
    const oran = Math.min(1, 500 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * oran));
    canvas.height = Math.max(1, Math.round(img.height * oran));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FirmaSayfasi() {
  const [form, setForm] = useState<FormVerisi>(bosForm);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState("");
  const [kaydedildi, setKaydedildi] = useState(false);

  useEffect(() => {
    fetch("/api/firma")
      .then(async (yanit) => {
        if (yanit.status === 404) return null; // henüz kayıt yok, boş form
        if (!yanit.ok) throw new Error();
        return yanit.json();
      })
      .then((firma) => {
        if (firma) {
          setForm({
            ad: firma.ad ?? "",
            adres: firma.adres ?? "",
            telefon: firma.telefon ?? "",
            vergiNo: firma.vergiNo ?? "",
            logo: firma.logo ?? "",
          });
        }
      })
      .catch(() => setHata("Firma bilgileri yüklenemedi"))
      .finally(() => setYukleniyor(false));
  }, []);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setKaydediliyor(true);
    setHata("");
    setKaydedildi(false);

    const govde = {
      ad: form.ad.trim(),
      adres: form.adres.trim() || null,
      telefon: form.telefon.trim() || null,
      vergiNo: form.vergiNo.trim() || null,
      logo: form.logo || null,
    };

    try {
      const yanit = await fetch("/api/firma", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      if (!yanit.ok) {
        const j = await yanit.json().catch(() => null);
        setHata(j?.hata ?? "Kaydetme başarısız oldu");
        return;
      }
      setKaydedildi(true);
      setTimeout(() => setKaydedildi(false), 3000);
    } catch {
      setHata("Sunucuya ulaşılamadı");
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Firma Bilgileri</h1>
      <p className="mt-1 text-sm text-slate-500">
        Bu bilgiler ileride raporlarda ve belgelerde kullanılacak
      </p>

      <div className="mt-6 max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-sky-100 p-2.5 text-sky-600">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Firma Kartı</h2>
            <p className="text-xs text-slate-400">Tek kayıt — değişiklikler hemen geçerli olur</p>
          </div>
        </div>

        {yukleniyor ? (
          <p className="py-6 text-sm text-slate-500">Yükleniyor…</p>
        ) : (
          <form onSubmit={kaydet} className="space-y-4">
            <div>
              <label className={etiketSinifi}>Logo</label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {form.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.logo}
                      alt="Firma logosu önizleme"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImagePlus size={24} className="text-slate-300" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50">
                    <ImagePlus size={15} />
                    {form.logo ? "Logoyu Değiştir" : "Logo Yükle"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const dosya = e.target.files?.[0];
                        e.target.value = "";
                        if (!dosya) return;
                        try {
                          setForm((f) => ({ ...f, logo: "" }));
                          const logo = await logoOku(dosya);
                          setForm((f) => ({ ...f, logo }));
                        } catch {
                          setHata("Logo okunamadı, farklı bir görsel deneyin");
                        }
                      }}
                    />
                  </label>
                  {form.logo && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logo: "" })}
                      className="w-fit text-xs text-red-500 hover:underline"
                    >
                      Logoyu kaldır
                    </button>
                  )}
                  <p className="text-xs text-slate-400">
                    PNG/JPG · teklif ve resmi belge çıktılarında kullanılır
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="ad" className={etiketSinifi}>
                Firma Adı <span className="text-red-500">*</span>
              </label>
              <input
                id="ad"
                required
                value={form.ad}
                onChange={(e) => setForm({ ...form, ad: e.target.value })}
                className={girdiSinifi}
              />
            </div>

            <div>
              <label htmlFor="adres" className={etiketSinifi}>
                Adres
              </label>
              <textarea
                id="adres"
                rows={2}
                value={form.adres}
                onChange={(e) => setForm({ ...form, adres: e.target.value })}
                className={girdiSinifi}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="telefon" className={etiketSinifi}>
                  Telefon
                </label>
                <input
                  id="telefon"
                  type="tel"
                  value={form.telefon}
                  onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                  className={girdiSinifi}
                />
              </div>
              <div>
                <label htmlFor="vergiNo" className={etiketSinifi}>
                  Vergi No
                </label>
                <input
                  id="vergiNo"
                  value={form.vergiNo}
                  onChange={(e) => setForm({ ...form, vergiNo: e.target.value })}
                  className={girdiSinifi}
                />
              </div>
            </div>

            {hata && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              {kaydedildi && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <Check size={16} />
                  Kaydedildi
                </span>
              )}
              <button
                type="submit"
                disabled={kaydediliyor}
                className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
              >
                {kaydediliyor ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
