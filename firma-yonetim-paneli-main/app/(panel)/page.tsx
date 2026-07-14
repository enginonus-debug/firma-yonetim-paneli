"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  Cake,
  FileText,
  Handshake,
  ListTodo,
  PartyPopper,
  Phone,
} from "lucide-react";
import TakvimKarti from "@/components/TakvimKarti";
import BildirimKarti from "@/components/BildirimKarti";

// Alanlar izinlere göre gelir: kullanıcının okuma izni olmayan modülün
// bölümü API yanıtında hiç bulunmaz, kartı da gösterilmez.
type Ozet = {
  gorevler?: { bekliyor: number; devamEdiyor: number; tamamlandi: number };
  devam?: {
    aktifCalisan: number;
    geldi: number;
    gelmedi: number;
    izinli: number;
    kayitsiz: number;
  };
  tahsilat?: {
    bekleyenTutar: number;
    bekleyenAdet: number;
    gecikenTutar: number;
    gecikenAdet: number;
  };
  acikFirsatSayisi?: number;
  sorunluMakineler?: {
    id: number;
    ad: string;
    durum: string;
    durumNotu: string | null;
    sorumlu: { adSoyad: string } | null;
    olaylar: { baslangic: string }[];
  }[];
  yaklasanTahsilatlar?: {
    id: number;
    tutar: string;
    vadeTarihi: string | null;
    musteri: { id: number; ad: string };
  }[];
  gecikenTahsilatlar?: {
    id: number;
    tutar: string;
    vadeTarihi: string | null;
    musteri: { id: number; ad: string };
  }[];
  acikGorevler?: {
    id: number;
    baslik: string;
    durum: string;
    atamalar: { kullanici: { adSoyad: string } }[];
  }[];
  bugunDoganlar?: {
    id: number;
    adSoyad: string;
    telefon: string | null;
    dogumTarihi: string | null;
    foto: string | null;
  }[];
  bugunYilDonumu?: {
    id: number;
    adSoyad: string;
    telefon: string | null;
    iseBaslama: string | null;
    yil: number;
    foto: string | null;
  }[];
  onayBekleyenTeklif?: number;
};

const para = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

function tarihGoster(t: string | null) {
  return t ? new Date(t).toLocaleDateString("tr-TR") : "—";
}

// Bugüne göre gün farkı ("3 gündür", "2 gün sonra" gibi metinler için)
function gunFarki(t: string) {
  const ms = new Date(t).getTime() - Date.now();
  return Math.round(Math.abs(ms) / 86_400_000);
}

type Kart = {
  baslik: string;
  deger: string;
  alt: string;
  Ikon: typeof ListTodo;
  renk: string;
  href: string;
};

export default function PanelSayfasi() {
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [hata, setHata] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((y) => {
        if (!y.ok) throw new Error();
        return y.json();
      })
      .then(setOzet)
      .catch(() => setHata("Özet veriler yüklenemedi"));
  }, []);

  if (hata) return <p className="text-red-600">{hata}</p>;
  if (!ozet) return <p className="text-slate-500">Yükleniyor…</p>;

  const kartlar: Kart[] = [];

  if (ozet.gorevler) {
    kartlar.push({
      baslik: "Açık Görevler",
      deger: String(ozet.gorevler.bekliyor + ozet.gorevler.devamEdiyor),
      alt: `${ozet.gorevler.devamEdiyor} devam ediyor · ${ozet.gorevler.bekliyor} bekliyor`,
      Ikon: ListTodo,
      renk: "text-sky-600 bg-sky-50",
      href: "/gorevler",
    });
  }
  if (ozet.devam) {
    kartlar.push({
      baslik: "Bugünkü Devam",
      deger: `${ozet.devam.geldi}/${ozet.devam.aktifCalisan}`,
      alt: `${ozet.devam.izinli} izinli · ${ozet.devam.gelmedi} gelmedi · ${ozet.devam.kayitsiz} kayıtsız`,
      Ikon: CalendarCheck,
      renk: "text-emerald-600 bg-emerald-50",
      href: "/devam",
    });
  }
  if (ozet.tahsilat) {
    kartlar.push(
      {
        baslik: "Bekleyen Tahsilat",
        deger: para.format(ozet.tahsilat.bekleyenTutar),
        alt: `${ozet.tahsilat.bekleyenAdet} kayıt`,
        Ikon: Banknote,
        renk: "text-amber-600 bg-amber-50",
        href: "/tahsilatlar",
      },
      {
        baslik: "Geciken Tahsilat",
        deger: para.format(ozet.tahsilat.gecikenTutar),
        alt: `${ozet.tahsilat.gecikenAdet} kayıt`,
        Ikon: AlertTriangle,
        renk: "text-red-600 bg-red-50",
        href: "/tahsilatlar",
      }
    );
  }
  if (ozet.acikFirsatSayisi !== undefined) {
    kartlar.push({
      baslik: "Açık Fırsatlar",
      deger: String(ozet.acikFirsatSayisi),
      alt: "potansiyel + görüşülüyor",
      Ikon: Handshake,
      renk: "text-violet-600 bg-violet-50",
      href: "/musteriler",
    });
  }
  if (ozet.onayBekleyenTeklif !== undefined && ozet.onayBekleyenTeklif > 0) {
    kartlar.push({
      baslik: "Onayınızı Bekleyen Teklif",
      deger: String(ozet.onayBekleyenTeklif),
      alt: "fiyat teklifi onay bekliyor",
      Ikon: FileText,
      renk: "text-amber-600 bg-amber-50",
      href: "/teklifler",
    });
  }

  const durumEtiketi: Record<string, string> = {
    bekliyor: "Bekliyor",
    devam_ediyor: "Devam ediyor",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Panel</h1>
      <p className="mt-1 text-sm text-slate-500">
        {new Date().toLocaleDateString("tr-TR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      <div className="mt-6">
        <TakvimKarti />
      </div>

      <div className="mt-6">
        <BildirimKarti />
      </div>

      {kartlar.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          Henüz görüntüleme izniniz olan bir modül yok. Yöneticinizle iletişime geçin.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kartlar.map(({ baslik, deger, alt, Ikon, renk, href }) => (
          <Link
            key={baslik}
            href={href}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className={`inline-flex rounded-lg p-2 ${renk}`}>
              <Ikon size={20} />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">{baslik}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{deger}</p>
            <p className="mt-1 text-xs text-slate-400">{alt}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {ozet.yaklasanTahsilatlar && (
          <section className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800">
              Vadesi Yaklaşan Tahsilatlar
              <span className="ml-2 text-xs font-normal text-slate-400">önümüzdeki 7 gün</span>
            </h2>
            {ozet.yaklasanTahsilatlar.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">7 gün içinde vadesi dolacak tahsilat yok.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {ozet.yaklasanTahsilatlar.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{t.musteri.ad}</p>
                      <p className="text-xs text-amber-600">
                        Vade: {tarihGoster(t.vadeTarihi)}
                        {t.vadeTarihi && ` · ${gunFarki(t.vadeTarihi)} gün kaldı`}
                      </p>
                    </div>
                    <span className="font-semibold text-amber-600">
                      {para.format(Number(t.tutar))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {ozet.sorunluMakineler && (
          <section className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800">Bakımda / Arızalı Makineler</h2>
            {ozet.sorunluMakineler.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Tüm makineler çalışıyor. 🎉</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {ozet.sorunluMakineler.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{m.ad}</p>
                      <p className="text-xs text-slate-400">
                        {m.sorumlu ? `Sorumlu: ${m.sorumlu.adSoyad}` : "Sorumlu atanmamış"}
                        {m.durumNotu ? ` · ${m.durumNotu}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.durum === "arizali"
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {m.durum === "arizali" ? "Arızalı" : "Bakımda"}
                      {m.olaylar[0] && ` · ${gunFarki(m.olaylar[0].baslangic)} gündür`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {ozet.gecikenTahsilatlar && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800">Vadesi Geçen Tahsilatlar</h2>
            {ozet.gecikenTahsilatlar.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Vadesi geçen tahsilat yok. 🎉</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {ozet.gecikenTahsilatlar.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{t.musteri.ad}</p>
                      <p className="text-xs text-slate-400">
                        Vade: {tarihGoster(t.vadeTarihi)}
                      </p>
                    </div>
                    <span className="font-semibold text-red-600">
                      {para.format(Number(t.tutar))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {ozet.acikGorevler && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800">Son Açık Görevler</h2>
            {ozet.acikGorevler.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Açık görev yok.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {ozet.acikGorevler.map((g) => (
                  <li key={g.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{g.baslik}</p>
                      <p className="text-xs text-slate-400">
                        {g.atamalar.length > 0
                          ? g.atamalar.map((a) => a.kullanici.adSoyad).join(", ")
                          : "Atanmamış"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        g.durum === "devam_ediyor"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {durumEtiketi[g.durum] ?? g.durum}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {ozet.bugunDoganlar && ozet.bugunDoganlar.length > 0 && (
        <section className="mt-6 rounded-xl border border-pink-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            <Cake size={18} className="text-pink-500" />
            Bugün Doğum Günü Olanlar 🎉
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ozet.bugunDoganlar.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-pink-100 bg-pink-50/40 p-3"
              >
                {c.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.foto}
                    alt={`${c.adSoyad} fotoğrafı`}
                    className="h-12 w-12 shrink-0 rounded-full border border-white object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-semibold text-pink-600">
                    {c.adSoyad
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toLocaleUpperCase("tr-TR")}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{c.adSoyad}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Cake size={12} className="text-pink-400" />
                    {c.dogumTarihi
                      ? new Date(c.dogumTarihi).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          timeZone: "UTC",
                        })
                      : "—"}
                  </p>
                  {c.telefon && (
                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      <Phone size={12} className="text-slate-400" />
                      {c.telefon}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ozet.bugunYilDonumu && ozet.bugunYilDonumu.length > 0 && (
        <section className="mt-6 rounded-xl border border-violet-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            <PartyPopper size={18} className="text-violet-500" />
            Bugün İş Yıl Dönümü Olanlar 🎊
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ozet.bugunYilDonumu.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-violet-100 bg-violet-50/40 p-3"
              >
                {c.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.foto}
                    alt={`${c.adSoyad} fotoğrafı`}
                    className="h-12 w-12 shrink-0 rounded-full border border-white object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-600">
                    {c.adSoyad
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toLocaleUpperCase("tr-TR")}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{c.adSoyad}</p>
                  <p className="flex items-center gap-1 text-xs text-violet-600">
                    <PartyPopper size={12} className="text-violet-400" />
                    {c.yil}. yıl
                  </p>
                  {c.telefon && (
                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      <Phone size={12} className="text-slate-400" />
                      {c.telefon}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
