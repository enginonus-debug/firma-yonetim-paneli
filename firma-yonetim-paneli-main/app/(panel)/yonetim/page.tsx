"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, KeyRound, Pause, Play, Plus, UserCog } from "lucide-react";
import Modal from "@/components/Modal";
import { etiketSinifi, girdiSinifi } from "@/lib/format";

type FirmaKullanicisi = {
  id: number;
  email: string;
  adSoyad: string;
  rol: string;
  aktif: boolean;
};

type Firma = {
  id: number;
  ad: string;
  telefon: string | null;
  aktif: boolean;
  kullanicilar: FirmaKullanicisi[];
};

const butonSinifi =
  "rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60";

export default function YonetimSayfasi() {
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [yeniAcik, setYeniAcik] = useState(false);
  const [sifreHedefi, setSifreHedefi] = useState<FirmaKullanicisi | null>(null);

  const yenile = useCallback(() => {
    fetch("/api/yonetim/firmalar")
      .then(async (y) => {
        if (!y.ok) throw new Error((await y.json().catch(() => null))?.hata);
        return y.json();
      })
      .then(setFirmalar)
      .catch((e) => setHata(e?.message || "Firmalar yüklenemedi"))
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yenile, [yenile]);

  async function aktifDegistir(firma: Firma) {
    const onay = firma.aktif
      ? `"${firma.ad}" askıya alınsın mı? Firmanın tüm kullanıcıları anında erişimini kaybeder.`
      : `"${firma.ad}" yeniden aktifleştirilsin mi?`;
    if (!window.confirm(onay)) return;

    const y = await fetch(`/api/yonetim/firmalar/${firma.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktif: !firma.aktif }),
    });
    if (!y.ok) {
      setHata((await y.json().catch(() => null))?.hata ?? "İşlem başarısız oldu");
      return;
    }
    yenile();
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Firmalar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Müşteri firmaları, admin hesapları ve sistem erişimini yönetin
          </p>
        </div>
        <button onClick={() => setYeniAcik(true)} className={`${butonSinifi} flex items-center gap-2`}>
          <Plus size={16} />
          Yeni Firma
        </button>
      </div>

      {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}

      {yukleniyor ? (
        <p className="mt-6 text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <div className="mt-6 space-y-4">
          {firmalar.map((firma) => (
            <section
              key={firma.id}
              className={`rounded-xl border bg-white p-5 shadow-sm ${
                firma.aktif ? "border-slate-200" : "border-red-200 bg-red-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2.5 ${
                      firma.aktif ? "bg-sky-100 text-sky-600" : "bg-red-100 text-red-600"
                    }`}
                  >
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800">
                      {firma.ad}
                      <span className="ml-2 text-xs font-normal text-slate-400">#{firma.id}</span>
                    </h2>
                    <span
                      className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        firma.aktif ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {firma.aktif ? "Aktif" : "Askıda"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => aktifDegistir(firma)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    firma.aktif
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  }`}
                >
                  {firma.aktif ? <Pause size={14} /> : <Play size={14} />}
                  {firma.aktif ? "Askıya Al" : "Aktifleştir"}
                </button>
              </div>

              <table className="mt-4 w-full text-sm">
                <thead className="text-left text-xs font-medium uppercase text-slate-400">
                  <tr>
                    <th className="py-1.5">Kullanıcı</th>
                    <th className="py-1.5">Ad Soyad</th>
                    <th className="py-1.5">Rol</th>
                    <th className="py-1.5">Durum</th>
                    <th className="py-1.5">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {firma.kullanicilar.map((k) => (
                    <tr key={k.id}>
                      <td className="py-2 font-medium text-slate-700">
                        <span className="flex items-center gap-1.5">
                          {k.rol === "admin" && <UserCog size={14} className="text-sky-600" />}
                          {k.email}
                        </span>
                      </td>
                      <td className="py-2">{k.adSoyad}</td>
                      <td className="py-2 text-slate-500">
                        {k.rol === "admin" ? "Firma Admini" : "Kullanıcı"}
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            k.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {k.aktif ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => setSifreHedefi(k)}
                          className="flex items-center gap-1 text-xs text-sky-600 hover:underline"
                        >
                          <KeyRound size={13} />
                          Şifre Sıfırla
                        </button>
                      </td>
                    </tr>
                  ))}
                  {firma.kullanicilar.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-2 text-xs text-slate-400">
                        Kullanıcı yok
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {yeniAcik && (
        <YeniFirmaModal
          kapat={() => setYeniAcik(false)}
          tamam={() => {
            setYeniAcik(false);
            yenile();
          }}
        />
      )}
      {sifreHedefi && (
        <SifreSifirlaModal kullanici={sifreHedefi} kapat={() => setSifreHedefi(null)} />
      )}
    </div>
  );
}

function YeniFirmaModal({ kapat, tamam }: { kapat: () => void; tamam: () => void }) {
  const [form, setForm] = useState({
    ad: "",
    telefon: "",
    adminKullaniciAdi: "",
    adminAdSoyad: "",
    adminSifre: "",
  });
  const [hata, setHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setGonderiliyor(true);
    setHata("");
    try {
      const y = await fetch("/api/yonetim/firmalar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad: form.ad.trim(),
          telefon: form.telefon.trim() || null,
          adminKullaniciAdi: form.adminKullaniciAdi.toLowerCase().trim(),
          adminAdSoyad: form.adminAdSoyad.trim(),
          adminSifre: form.adminSifre,
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
    <Modal baslik="Yeni Firma + Admin Hesabı" kapat={kapat} genis>
      <form onSubmit={gonder} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiketSinifi}>
              Firma Adı <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.ad}
              onChange={(e) => setForm({ ...form, ad: e.target.value })}
              className={girdiSinifi}
            />
          </div>
          <div>
            <label className={etiketSinifi}>Telefon</label>
            <input
              value={form.telefon}
              onChange={(e) => setForm({ ...form, telefon: e.target.value })}
              className={girdiSinifi}
            />
          </div>
        </div>

        <p className="border-t border-slate-100 pt-3 text-xs font-medium uppercase text-slate-400">
          Firma Admini
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiketSinifi}>
              Kullanıcı Adı <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.adminKullaniciAdi}
              onChange={(e) => setForm({ ...form, adminKullaniciAdi: e.target.value })}
              className={girdiSinifi}
              placeholder="ör. mobilyaci.admin"
            />
          </div>
          <div>
            <label className={etiketSinifi}>
              Ad Soyad <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.adminAdSoyad}
              onChange={(e) => setForm({ ...form, adminAdSoyad: e.target.value })}
              className={girdiSinifi}
            />
          </div>
        </div>
        <div>
          <label className={etiketSinifi}>
            Admin Şifresi <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="password"
            minLength={6}
            value={form.adminSifre}
            onChange={(e) => setForm({ ...form, adminSifre: e.target.value })}
            className={girdiSinifi}
          />
        </div>

        {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={kapat} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Vazgeç
          </button>
          <button type="submit" disabled={gonderiliyor} className={butonSinifi}>
            {gonderiliyor ? "Oluşturuluyor…" : "Firma + Admin Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SifreSifirlaModal({
  kullanici,
  kapat,
}: {
  kullanici: FirmaKullanicisi;
  kapat: () => void;
}) {
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [basarili, setBasarili] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setGonderiliyor(true);
    setHata("");
    try {
      const y = await fetch(`/api/yonetim/kullanicilar/${kullanici.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sifre }),
      });
      if (!y.ok) {
        setHata((await y.json().catch(() => null))?.hata ?? "İşlem başarısız oldu");
        return;
      }
      setBasarili(true);
    } catch {
      setHata("Sunucuya ulaşılamadı");
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <Modal baslik={`Şifre Sıfırla: ${kullanici.email}`} kapat={kapat}>
      {basarili ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Şifre güncellendi. Yeni şifreyi kullanıcıya iletin.
          </p>
          <div className="flex justify-end">
            <button onClick={kapat} className={butonSinifi}>
              Tamam
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={gonder} className="space-y-4">
          <div>
            <label className={etiketSinifi}>
              Yeni Şifre <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="password"
              minLength={6}
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className={girdiSinifi}
              autoFocus
            />
          </div>
          {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={kapat} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Vazgeç
            </button>
            <button type="submit" disabled={gonderiliyor} className={butonSinifi}>
              {gonderiliyor ? "Kaydediliyor…" : "Şifreyi Değiştir"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
