"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Pencil, Plus, Trash2, UserCog, X } from "lucide-react";
import Modal from "@/components/Modal";
import IzinMatrisi, { bosIzinler, IZIN_MODULLERI, type IzinlerFormu } from "@/components/IzinMatrisi";
import { etiketSinifi, girdiSinifi } from "@/lib/format";

type Kullanici = {
  id: number;
  email: string;
  adSoyad: string;
  rol: string;
  izinler: IzinlerFormu | null;
  aktif: boolean;
  onayDurumu: string; // onaylandi | bekliyor
  calisanId: number | null;
  calisan: { adSoyad: string } | null;
};

const butonSinifi =
  "rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60";

function izinOzeti(k: Kullanici) {
  if (k.rol === "admin") return "Tüm ekranlar (admin)";
  const izinler = k.izinler ?? {};
  const acik = IZIN_MODULLERI.filter((m) => izinler[m.anahtar] && izinler[m.anahtar] !== "yok");
  if (acik.length === 0) return "Hiçbir ekran";
  return acik
    .map((m) => `${m.etiket}${izinler[m.anahtar] === "yazma" ? " (düzenleme)" : ""}`)
    .join(", ");
}

export default function KullanicilarSayfasi() {
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [yeniAcik, setYeniAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Kullanici | null>(null);
  const [karariVerilen, setKarariVerilen] = useState<number | null>(null); // onay/red gönderilen id

  const yenile = useCallback(() => {
    fetch("/api/kullanicilar")
      .then(async (y) => {
        if (!y.ok) throw new Error((await y.json().catch(() => null))?.hata);
        return y.json();
      })
      .then(setKullanicilar)
      .catch((e) => setHata(e?.message || "Kullanıcılar yüklenemedi"))
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yenile, [yenile]);

  // Çalışanlar ekranından atanan hesaplar admin onaylayana kadar burada bekler
  const bekleyenler = kullanicilar.filter((k) => k.onayDurumu === "bekliyor");
  const onaylilar = kullanicilar.filter((k) => k.onayDurumu !== "bekliyor");

  async function kaliciSil(k: Kullanici) {
    if (
      !window.confirm(
        `"${k.email}" hesabı KALICI olarak silinsin mi?\n\nBu işlem geri alınamaz; kullanıcının görev atamaları ve bildirimleri de silinir.`
      )
    )
      return;
    setHata("");
    const y = await fetch(`/api/kullanicilar/${k.id}`, { method: "DELETE" });
    if (y.ok) yenile();
    else setHata((await y.json().catch(() => null))?.hata ?? "Silme başarısız oldu");
  }

  async function kararVer(k: Kullanici, karar: "onayla" | "reddet") {
    if (karar === "reddet" && !confirm(`${k.email} talebi reddedilsin mi? Hesap silinecek.`)) {
      return;
    }
    setKarariVerilen(k.id);
    setHata("");
    try {
      const y = await fetch(`/api/kullanicilar/${k.id}/onay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ karar }),
      });
      if (!y.ok) {
        setHata((await y.json().catch(() => null))?.hata ?? "İşlem başarısız oldu");
        return;
      }
      yenile();
    } catch {
      setHata("Sunucuya ulaşılamadı");
    } finally {
      setKarariVerilen(null);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kullanıcılar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kullanıcı ekleyin ve her ekran için görüntüleme/düzenleme izni atayın
          </p>
        </div>
        <button onClick={() => setYeniAcik(true)} className={`${butonSinifi} flex items-center gap-2`}>
          <Plus size={16} />
          Yeni Kullanıcı
        </button>
      </div>

      {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}

      {!yukleniyor && bekleyenler.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 shadow-sm">
          <div className="border-b border-amber-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-amber-800">
              Onay Bekleyen Kullanıcı Talepleri ({bekleyenler.length})
            </h2>
            <p className="text-xs text-amber-700">
              Çalışanlar ekranından atanan bu hesaplar, siz onaylayana kadar giriş yapamaz
            </p>
          </div>
          <ul className="divide-y divide-amber-100">
            {bekleyenler.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {k.adSoyad}
                    <span className="ml-2 text-xs font-normal text-slate-500">{k.email}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {k.calisan ? `Çalışan: ${k.calisan.adSoyad} · ` : ""}
                    İzinler: {izinOzeti(k)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => kararVer(k, "onayla")}
                    disabled={karariVerilen === k.id}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check size={15} />
                    Onayla
                  </button>
                  <button
                    onClick={() => kararVer(k, "reddet")}
                    disabled={karariVerilen === k.id}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                  >
                    <X size={15} />
                    Reddet
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {yukleniyor ? (
        <p className="mt-6 text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Kullanıcı Adı</th>
                <th className="px-4 py-3">Ad Soyad</th>
                <th className="px-4 py-3">Erişebildiği Ekranlar</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {onaylilar.map((k) => (
                <tr key={k.id} className={k.aktif ? "" : "opacity-60"}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <span className="flex items-center gap-2">
                      {k.rol === "admin" && <UserCog size={15} className="text-sky-600" />}
                      {k.email}
                    </span>
                  </td>
                  <td className="px-4 py-3">{k.adSoyad}</td>
                  <td className="max-w-md px-4 py-3 text-xs text-slate-500">{izinOzeti(k)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        k.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {k.aktif ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {(k.rol === "kullanici" || k.rol === "admin") && (
                        <button
                          onClick={() => setDuzenlenen(k)}
                          className="flex items-center gap-1.5 text-sm text-sky-600 hover:underline"
                        >
                          <Pencil size={14} />
                          Düzenle
                        </button>
                      )}
                      {!k.aktif && (
                        <button
                          onClick={() => kaliciSil(k)}
                          title="Kalıcı olarak sil (geri alınamaz)"
                          className="flex items-center gap-1.5 text-sm text-red-600 hover:underline"
                        >
                          <Trash2 size={14} />
                          Kalıcı Sil
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {yeniAcik && (
        <YeniKullaniciModal
          kapat={() => setYeniAcik(false)}
          tamam={() => {
            setYeniAcik(false);
            yenile();
          }}
        />
      )}
      {duzenlenen && (
        <DuzenleModal
          kullanici={duzenlenen}
          kapat={() => setDuzenlenen(null)}
          tamam={() => {
            setDuzenlenen(null);
            yenile();
          }}
        />
      )}
    </div>
  );
}

function YeniKullaniciModal({ kapat, tamam }: { kapat: () => void; tamam: () => void }) {
  const [form, setForm] = useState({ kullaniciAdi: "", adSoyad: "", sifre: "" });
  const [rol, setRol] = useState<"kullanici" | "admin">("kullanici");
  const [izinler, setIzinler] = useState<IzinlerFormu>({ ...bosIzinler });
  const [hata, setHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setGonderiliyor(true);
    setHata("");
    try {
      const y = await fetch("/api/kullanicilar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          kullaniciAdi: form.kullaniciAdi.toLowerCase().trim(),
          rol,
          izinler,
        }),
      });
      if (!y.ok) {
        setHata((await y.json().catch(() => null))?.hata ?? "Kaydetme başarısız oldu");
        return;
      }
      tamam();
    } catch {
      setHata("Sunucuya ulaşılamadı");
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <Modal baslik="Yeni Kullanıcı" kapat={kapat} genis>
      <form onSubmit={gonder} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiketSinifi}>
              Kullanıcı Adı <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.kullaniciAdi}
              onChange={(e) => setForm({ ...form, kullaniciAdi: e.target.value })}
              className={girdiSinifi}
              placeholder="ör. ahmet.yilmaz"
            />
          </div>
          <div>
            <label className={etiketSinifi}>
              Ad Soyad <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.adSoyad}
              onChange={(e) => setForm({ ...form, adSoyad: e.target.value })}
              className={girdiSinifi}
            />
          </div>
        </div>
        <div>
          <label className={etiketSinifi}>
            Şifre <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="password"
            minLength={6}
            value={form.sifre}
            onChange={(e) => setForm({ ...form, sifre: e.target.value })}
            className={girdiSinifi}
          />
        </div>
        <RolSecici rol={rol} degistir={setRol} />
        {rol === "kullanici" ? (
          <div>
            <label className={etiketSinifi}>Ekran İzinleri</label>
            <IzinMatrisi izinler={izinler} degistir={setIzinler} />
          </div>
        ) : (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
            Yönetici (admin) tüm ekranlara erişir ve kendisine gönderilen fiyat
            teklifi vb. işlemleri onaylayabilir. Ayrı izin seçimi gerekmez.
          </p>
        )}

        {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={kapat} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Vazgeç
          </button>
          <button type="submit" disabled={gonderiliyor} className={butonSinifi}>
            {gonderiliyor ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Rol seçimi (Kullanıcı / Yönetici) — kullanıcı ve düzenleme modallarında ortak
function RolSecici({
  rol,
  degistir,
}: {
  rol: "kullanici" | "admin";
  degistir: (r: "kullanici" | "admin") => void;
}) {
  return (
    <div>
      <label className={etiketSinifi}>Yetki</label>
      <div className="grid grid-cols-2 gap-2">
        {[
          { deger: "kullanici" as const, baslik: "Kullanıcı", aciklama: "İzin verilen ekranlar" },
          { deger: "admin" as const, baslik: "Yönetici (Admin)", aciklama: "Tüm ekranlar + onay" },
        ].map((s) => (
          <button
            key={s.deger}
            type="button"
            onClick={() => degistir(s.deger)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              rol === s.deger
                ? "border-sky-500 bg-sky-50 text-sky-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="block font-medium">{s.baslik}</span>
            <span className="block text-xs text-slate-400">{s.aciklama}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DuzenleModal({
  kullanici,
  kapat,
  tamam,
}: {
  kullanici: Kullanici;
  kapat: () => void;
  tamam: () => void;
}) {
  const [adSoyad, setAdSoyad] = useState(kullanici.adSoyad);
  const [rol, setRol] = useState<"kullanici" | "admin">(
    kullanici.rol === "admin" ? "admin" : "kullanici"
  );
  const [izinler, setIzinler] = useState<IzinlerFormu>({ ...bosIzinler, ...(kullanici.izinler ?? {}) });
  const [aktif, setAktif] = useState(kullanici.aktif);
  const [yeniSifre, setYeniSifre] = useState("");
  const [hata, setHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setGonderiliyor(true);
    setHata("");
    try {
      const y = await fetch(`/api/kullanicilar/${kullanici.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adSoyad,
          rol,
          izinler,
          aktif,
          ...(yeniSifre ? { sifre: yeniSifre } : {}),
        }),
      });
      if (!y.ok) {
        setHata((await y.json().catch(() => null))?.hata ?? "Kaydetme başarısız oldu");
        return;
      }
      tamam();
    } catch {
      setHata("Sunucuya ulaşılamadı");
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <Modal baslik={`Düzenle: ${kullanici.email}`} kapat={kapat} genis>
      <form onSubmit={gonder} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiketSinifi}>Ad Soyad</label>
            <input required value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} className={girdiSinifi} />
          </div>
          <div>
            <label className={etiketSinifi}>
              <span className="flex items-center gap-1.5">
                <KeyRound size={14} />
                Yeni Şifre (boş bırakılırsa değişmez)
              </span>
            </label>
            <input
              type="password"
              minLength={6}
              value={yeniSifre}
              onChange={(e) => setYeniSifre(e.target.value)}
              className={girdiSinifi}
            />
          </div>
        </div>
        <RolSecici rol={rol} degistir={setRol} />
        {rol === "kullanici" ? (
          <div>
            <label className={etiketSinifi}>Ekran İzinleri</label>
            <IzinMatrisi izinler={izinler} degistir={setIzinler} />
          </div>
        ) : (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
            Yönetici (admin) tüm ekranlara erişir ve kendisine gönderilen fiyat
            teklifi vb. işlemleri onaylayabilir.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={aktif}
            onChange={(e) => setAktif(e.target.checked)}
            className="size-4 accent-sky-600"
          />
          Hesap aktif (kapatılırsa kullanıcı anında giriş yapamaz)
        </label>

        {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={kapat} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Vazgeç
          </button>
          <button type="submit" disabled={gonderiliyor} className={butonSinifi}>
            {gonderiliyor ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
