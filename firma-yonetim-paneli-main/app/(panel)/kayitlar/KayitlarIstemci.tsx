"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import Sayfalama from "@/components/Sayfalama";
import { girdiSinifi } from "@/lib/format";

type Degisiklik = Record<string, { eski: unknown; yeni: unknown }>;

type Kayit = {
  id: number;
  firmaId: number;
  kullaniciAd: string;
  kullaniciEmail: string;
  kullaniciRol: string;
  ekran: string;
  islem: string;
  hedefTip: string | null;
  hedefId: number | null;
  hedefAd: string | null;
  detay: Degisiklik | null;
  zaman: string;
};

const EKRAN_ETIKETLERI: Record<string, string> = {
  calisanlar: "Çalışanlar",
  makineler: "Makineler",
  devam: "Devam / Puantaj",
  gorevler: "Görevler",
  musteriler: "Müşteriler & Satış",
  teklifler: "Fiyat Teklifleri",
  tahsilatlar: "Tahsilatlar",
  firma: "Firma Bilgileri",
  kullanicilar: "Kullanıcılar",
  hesap: "Hesap",
  yonetim: "Yönetim",
};

const ISLEM_ETIKETLERI: Record<string, { etiket: string; sinif: string }> = {
  ekleme: { etiket: "Ekleme", sinif: "bg-emerald-100 text-emerald-700" },
  guncelleme: { etiket: "Güncelleme", sinif: "bg-sky-100 text-sky-700" },
  silme: { etiket: "Silme", sinif: "bg-red-100 text-red-700" },
  "pasife-alma": { etiket: "Pasife Alma", sinif: "bg-amber-100 text-amber-700" },
  "sifre-degistirme": { etiket: "Şifre Değiştirme", sinif: "bg-violet-100 text-violet-700" },
  "ozel-bilgi-goruntuleme": {
    etiket: "Özel Bilgi Görüntüleme",
    sinif: "bg-slate-200 text-slate-700",
  },
  "onay-talebi": { etiket: "Kullanıcı Atama Talebi", sinif: "bg-amber-100 text-amber-700" },
  onaylama: { etiket: "Onaylama", sinif: "bg-emerald-100 text-emerald-700" },
  reddetme: { etiket: "Reddetme", sinif: "bg-red-100 text-red-700" },
};

// Değişiklik detayındaki değerleri okunur metne çevirir
function degerGoster(deger: unknown): string {
  if (deger === null || deger === undefined || deger === "") return "—";
  if (typeof deger === "boolean") return deger ? "Evet" : "Hayır";
  if (typeof deger === "object") return JSON.stringify(deger);
  return String(deger);
}

export default function KayitlarIstemci({ superadmin }: { superadmin: boolean }) {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [toplam, setToplam] = useState(0);
  const [sayfa, setSayfa] = useState(1);
  const [limit] = useState(25);
  const [ekran, setEkran] = useState("");
  const [islem, setIslem] = useState("");
  const [acikId, setAcikId] = useState<number | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  const yenile = useCallback(() => {
    setYukleniyor(true);
    const parametreler = new URLSearchParams({ sayfa: String(sayfa), limit: String(limit) });
    if (ekran) parametreler.set("ekran", ekran);
    if (islem) parametreler.set("islem", islem);
    fetch(`/api/kayitlar?${parametreler}`)
      .then(async (y) => {
        if (!y.ok) throw new Error((await y.json().catch(() => null))?.hata);
        return y.json();
      })
      .then((v) => {
        setKayitlar(v.veriler);
        setToplam(v.toplam);
      })
      .catch((e) => setHata(e?.message || "Kayıtlar yüklenemedi"))
      .finally(() => setYukleniyor(false));
  }, [sayfa, limit, ekran, islem]);

  useEffect(yenile, [yenile]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">İşlem Kayıtları</h1>
      <p className="mt-1 text-sm text-slate-500">
        Panelde yapılan tüm değişikliklerin izi: kim, ne zaman, hangi ekranda, neyi değiştirdi
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={ekran}
          onChange={(e) => {
            setEkran(e.target.value);
            setSayfa(1);
          }}
          className={`${girdiSinifi} w-52`}
        >
          <option value="">Tüm ekranlar</option>
          {Object.entries(EKRAN_ETIKETLERI).map(([anahtar, etiket]) => (
            <option key={anahtar} value={anahtar}>
              {etiket}
            </option>
          ))}
        </select>
        <select
          value={islem}
          onChange={(e) => {
            setIslem(e.target.value);
            setSayfa(1);
          }}
          className={`${girdiSinifi} w-52`}
        >
          <option value="">Tüm işlemler</option>
          {Object.entries(ISLEM_ETIKETLERI).map(([anahtar, { etiket }]) => (
            <option key={anahtar} value={anahtar}>
              {etiket}
            </option>
          ))}
        </select>
      </div>

      {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}

      {yukleniyor ? (
        <p className="mt-6 text-sm text-slate-500">Yükleniyor…</p>
      ) : kayitlar.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Kayıt bulunamadı.</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="w-8 px-2 py-3"></th>
                <th className="px-4 py-3">Tarih / Saat</th>
                <th className="px-4 py-3">Kullanıcı</th>
                {superadmin && <th className="px-4 py-3">Firma</th>}
                <th className="px-4 py-3">Ekran</th>
                <th className="px-4 py-3">İşlem</th>
                <th className="px-4 py-3">Kayıt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kayitlar.map((k) => {
                const islemBilgi = ISLEM_ETIKETLERI[k.islem] ?? {
                  etiket: k.islem,
                  sinif: "bg-slate-200 text-slate-700",
                };
                const detayVar = k.detay && Object.keys(k.detay).length > 0;
                const acik = acikId === k.id;
                return (
                  <Fragment key={k.id}>
                    <tr
                      className={detayVar ? "cursor-pointer hover:bg-slate-50" : ""}
                      onClick={() => detayVar && setAcikId(acik ? null : k.id)}
                    >
                      <td className="px-2 py-3 text-slate-400">
                        {detayVar && (acik ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {new Date(k.zaman).toLocaleString("tr-TR", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{k.kullaniciAd}</span>
                        <span className="block text-xs text-slate-500">{k.kullaniciEmail}</span>
                      </td>
                      {superadmin && <td className="px-4 py-3 text-slate-600">#{k.firmaId}</td>}
                      <td className="px-4 py-3">{EKRAN_ETIKETLERI[k.ekran] ?? k.ekran}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${islemBilgi.sinif}`}
                        >
                          {islemBilgi.etiket}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {k.hedefAd ?? "—"}
                        {k.hedefTip && (
                          <span className="block text-xs text-slate-500">
                            {k.hedefTip}
                            {k.hedefId ? ` #${k.hedefId}` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                    {acik && detayVar && (
                      <tr className="bg-slate-50">
                        <td></td>
                        <td colSpan={superadmin ? 6 : 5} className="px-4 py-3">
                          <p className="mb-1.5 text-xs font-medium uppercase text-slate-500">
                            Değişen Alanlar
                          </p>
                          <ul className="space-y-1 text-xs text-slate-700">
                            {Object.entries(k.detay!).map(([alan, { eski, yeni }]) => (
                              <li key={alan}>
                                <span className="font-medium">{alan}:</span>{" "}
                                <span className="text-slate-500 line-through">{degerGoster(eski)}</span>
                                {" → "}
                                <span className="font-medium text-slate-900">{degerGoster(yeni)}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <Sayfalama sayfa={sayfa} toplam={toplam} limit={limit} onDegis={setSayfa} />
        </div>
      )}
    </div>
  );
}
