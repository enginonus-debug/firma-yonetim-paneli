"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  Lock,
  Paperclip,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import Modal from "@/components/Modal";
import { etiketSinifi, girdiSinifi, tarihGoster } from "@/lib/format";

type Atama = { rol: string; kullanici: { id: number; adSoyad: string } };
type Ek = {
  id: number;
  tur: string; // gorev | sonuc
  dosyaAd: string;
  mimeTip: string;
  boyut: number;
  yukleyenAd: string | null;
};

type Gorev = {
  id: number;
  baslik: string;
  aciklama: string | null;
  durum: string;
  oncelik: string | null;
  baslangic: string | null;
  bitis: string | null;
  makineId: number | null;
  makine: { id: number; ad: string } | null;
  olusturan: { id: number; adSoyad: string } | null;
  redNotu: string | null;
  atamalar: Atama[];
  ekler: Ek[];
};

type KullaniciSecenek = { id: number; adSoyad: string; rol: string };
type MakineSecenek = { id: number; ad: string };

type FormVerisi = {
  baslik: string;
  aciklama: string;
  makineId: string;
  oncelik: string;
  baslangic: string;
  bitis: string;
  atananlar: number[];
  denetciId: string;
  kontrolorId: string;
  izleyiciler: number[];
};

const bosForm: FormVerisi = {
  baslik: "",
  aciklama: "",
  makineId: "",
  oncelik: "normal",
  baslangic: "",
  bitis: "",
  atananlar: [],
  denetciId: "",
  kontrolorId: "",
  izleyiciler: [],
};

// Kanban kolonları: onay aşamaları tek "Onayda" kolonunda toplanır
const kolonlar = [
  { anahtar: "bekliyor", durumlar: ["bekliyor"], baslik: "Bekliyor", ust: "border-t-slate-400" },
  { anahtar: "devam", durumlar: ["devam_ediyor"], baslik: "Devam Ediyor", ust: "border-t-sky-500" },
  {
    anahtar: "onay",
    durumlar: ["kontrol_bekliyor", "denetim_bekliyor"],
    baslik: "Onayda",
    ust: "border-t-amber-500",
  },
  { anahtar: "tamam", durumlar: ["tamamlandi"], baslik: "Tamamlandı", ust: "border-t-emerald-500" },
];

const durumEtiketi: Record<string, string> = {
  kontrol_bekliyor: "Kontrolör onayında",
  denetim_bekliyor: "Denetçi onayında",
};

const oncelikler: Record<string, { etiket: string; sinif: string }> = {
  yuksek: { etiket: "Yüksek", sinif: "bg-red-100 text-red-700" },
  normal: { etiket: "Normal", sinif: "bg-sky-100 text-sky-700" },
  dusuk: { etiket: "Düşük", sinif: "bg-slate-100 text-slate-600" },
};

function boyutGoster(b: number) {
  return b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}
const EK_KABUL = ".png,.jpg,.jpeg,.webp,.pdf,.xml,.doc,.docx,.xls,.xlsx";

function atananlarDan(g: Gorev, rol: string) {
  return g.atamalar.filter((a) => a.rol === rol).map((a) => a.kullanici);
}

export default function GorevlerSayfasi() {
  const [gorevler, setGorevler] = useState<Gorev[]>([]);
  const [kullanicilar, setKullanicilar] = useState<KullaniciSecenek[]>([]);
  const [makineler, setMakineler] = useState<MakineSecenek[]>([]);
  const [benId, setBenId] = useState<number | null>(null);
  const [benRol, setBenRol] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [islemMesgul, setIslemMesgul] = useState<number | null>(null);

  const [form, setForm] = useState<FormVerisi | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<Gorev | null>(null);
  const [formHata, setFormHata] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const [ekDosyalar, setEkDosyalar] = useState<File[]>([]);
  const [ekler, setEkler] = useState<Ek[]>([]);
  const [ekHata, setEkHata] = useState("");
  const [ekMesgul, setEkMesgul] = useState(false);

  const yukle = useCallback(async () => {
    setHata("");
    try {
      const [gYanit, kYanit, mYanit, hYanit] = await Promise.all([
        fetch("/api/gorevler"),
        fetch("/api/kullanicilar/secenekler"),
        fetch("/api/makineler"),
        fetch("/api/hesap"),
      ]);
      if (!gYanit.ok || !kYanit.ok || !mYanit.ok) throw new Error();
      setGorevler(await gYanit.json());
      setKullanicilar(await kYanit.json());
      const ms: { id: number; ad: string }[] = await mYanit.json();
      setMakineler(ms.map((m) => ({ id: m.id, ad: m.ad })));
      if (hYanit.ok) {
        const h = await hYanit.json();
        setBenId(h.id);
        setBenRol(h.rol);
      }
    } catch {
      setHata("Görevler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  // Bildirimden gelen ?gorev=<id> varsa o görevi aç
  useEffect(() => {
    if (gorevler.length === 0) return;
    const p = new URLSearchParams(window.location.search);
    const gid = Number(p.get("gorev"));
    if (gid) {
      const g = gorevler.find((x) => x.id === gid);
      if (g) {
        ac(g);
        // param'ı temizle ki tekrar açılmasın
        window.history.replaceState(null, "", "/gorevler");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gorevler.length]);

  // Kullanıcının bu görevdeki rolleri
  function roluBul(g: Gorev) {
    const roller = new Set(
      g.atamalar.filter((a) => a.kullanici.id === benId).map((a) => a.rol)
    );
    return {
      atanan: roller.has("atanan"),
      kontrolor: roller.has("kontrolor"),
      denetci: roller.has("denetci"),
      atayan: g.olusturan?.id === benId,
    };
  }
  const adminMi = benRol === "admin";
  // Kısıtlı alanları düzenleme, ek silme ve görev silme YALNIZCA görevi oluşturana
  // aittir (admin dahil başkası yapamaz). Yeni görevde oluşturan kişi sensin.
  // İstisna: oluşturanı kayıtlı olmayan ESKİ görevleri (olusturan=null) adminler
  // yönetebilir — bu özellik eklenmeden önce açılmış görevler kilitli kalmasın.
  function duzenleyebilir(g: Gorev | null) {
    if (!g) return true;
    if (g.olusturan?.id === benId) return true;
    if (!g.olusturan && adminMi) return true;
    return false;
  }

  // Bu kullanıcının bu görevde yapabileceği iş akışı işlemleri
  function aksiyonlar(g: Gorev) {
    const r = roluBul(g);
    const list: { islem: "basla" | "tamamla" | "onayla" | "reddet"; etiket: string; tur: "ilerle" | "onay" | "red" }[] = [];
    if (g.durum === "bekliyor" && (r.atanan || adminMi))
      list.push({ islem: "basla", etiket: "Başla", tur: "ilerle" });
    if (g.durum === "devam_ediyor" && (r.atanan || adminMi))
      list.push({ islem: "tamamla", etiket: "Tamamla", tur: "onay" });
    if (g.durum === "kontrol_bekliyor" && (r.kontrolor || adminMi)) {
      list.push({ islem: "onayla", etiket: "Onayla", tur: "onay" });
      list.push({ islem: "reddet", etiket: "Reddet", tur: "red" });
    }
    if (g.durum === "denetim_bekliyor" && (r.denetci || adminMi)) {
      list.push({ islem: "onayla", etiket: "Onayla", tur: "onay" });
      list.push({ islem: "reddet", etiket: "Reddet", tur: "red" });
    }
    return list;
  }

  async function islemYap(g: Gorev, islem: "basla" | "tamamla" | "onayla" | "reddet") {
    let not: string | null = null;
    if (islem === "reddet") {
      const neden = window.prompt("Reddetme nedeni (görevliye iletilecek):", "");
      if (neden === null) return; // vazgeçildi
      not = neden.trim() || null;
    }
    setIslemMesgul(g.id);
    setHata("");
    const yanit = await fetch(`/api/gorevler/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ islem, not }),
    });
    setIslemMesgul(null);
    if (yanit.ok) {
      yukle();
      // Açık modal varsa güncelle
      if (duzenlenen?.id === g.id) kapat();
    } else {
      const j = await yanit.json().catch(() => null);
      setHata(j?.hata ?? "İşlem başarısız oldu");
    }
  }

  function yeniAc() {
    setDuzenlenen(null);
    setForm(bosForm);
    setEkDosyalar([]);
    setEkler([]);
    setEkHata("");
    setFormHata("");
  }

  // Görevi aç: düzenleyebilenler için düzenleme, diğerleri için salt-okunur detay
  function ac(g: Gorev) {
    setDuzenlenen(g);
    const denetci = atananlarDan(g, "denetci")[0];
    const kontrolor = atananlarDan(g, "kontrolor")[0];
    setForm({
      baslik: g.baslik,
      aciklama: g.aciklama ?? "",
      makineId: g.makineId ? String(g.makineId) : "",
      oncelik: g.oncelik ?? "normal",
      baslangic: g.baslangic?.slice(0, 10) ?? "",
      bitis: g.bitis?.slice(0, 10) ?? "",
      atananlar: atananlarDan(g, "atanan").map((k) => k.id),
      denetciId: denetci ? String(denetci.id) : "",
      kontrolorId: kontrolor ? String(kontrolor.id) : "",
      izleyiciler: atananlarDan(g, "izleyici").map((k) => k.id),
    });
    setEkDosyalar([]);
    setEkler(g.ekler ?? []);
    setEkHata("");
    setFormHata("");
  }

  function kapat() {
    setForm(null);
    setDuzenlenen(null);
    setEkDosyalar([]);
    setEkler([]);
  }

  async function ekYukle(gorevId: number, tur: "gorev" | "sonuc", dosya: File) {
    setEkMesgul(true);
    setEkHata("");
    const fd = new FormData();
    fd.append("dosya", dosya);
    const yanit = await fetch(`/api/gorevler/${gorevId}/ekler?tur=${tur}`, { method: "POST", body: fd });
    setEkMesgul(false);
    if (yanit.ok) {
      await eklerTazele(gorevId);
      yukle();
    } else {
      const j = await yanit.json().catch(() => null);
      setEkHata(j?.hata ?? "Belge yüklenemedi");
    }
  }

  async function ekSil(gorevId: number, ekId: number) {
    if (!window.confirm("Bu belge silinsin mi?")) return;
    const yanit = await fetch(`/api/gorevler/${gorevId}/ekler/${ekId}`, { method: "DELETE" });
    if (yanit.ok) {
      await eklerTazele(gorevId);
      yukle();
    } else setEkHata("Belge silinemedi");
  }

  async function eklerTazele(gorevId: number) {
    const r = await fetch(`/api/gorevler/${gorevId}/ekler`);
    if (r.ok) setEkler(await r.json());
  }

  function atamaDegistir(id: number) {
    if (!form) return;
    setForm({
      ...form,
      atananlar: form.atananlar.includes(id)
        ? form.atananlar.filter((x) => x !== id)
        : [...form.atananlar, id],
    });
  }

  function izleyiciDegistir(id: number) {
    if (!form) return;
    setForm({
      ...form,
      izleyiciler: form.izleyiciler.includes(id)
        ? form.izleyiciler.filter((x) => x !== id)
        : [...form.izleyiciler, id],
    });
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setKaydediliyor(true);
    setFormHata("");

    const govde = {
      baslik: form.baslik.trim(),
      aciklama: form.aciklama.trim() || null,
      makineId: form.makineId ? Number(form.makineId) : null,
      oncelik: form.oncelik,
      baslangic: form.baslangic || null,
      bitis: form.bitis || null,
      atananlar: form.atananlar,
      denetciId: form.denetciId ? Number(form.denetciId) : null,
      kontrolorId: form.kontrolorId ? Number(form.kontrolorId) : null,
      izleyiciler: form.izleyiciler,
    };

    try {
      const yanit = await fetch(
        duzenlenen ? `/api/gorevler/${duzenlenen.id}` : "/api/gorevler",
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
      if (!duzenlenen && ekDosyalar.length > 0) {
        const olusan = await yanit.json();
        for (const dosya of ekDosyalar) {
          const fd = new FormData();
          fd.append("dosya", dosya);
          const ekY = await fetch(`/api/gorevler/${olusan.id}/ekler?tur=gorev`, { method: "POST", body: fd });
          if (!ekY.ok) {
            const j = await ekY.json().catch(() => null);
            setFormHata(`Görev kaydedildi ancak "${dosya.name}" eklenemedi: ${j?.hata ?? "hata"}`);
            kapat();
            yukle();
            return;
          }
        }
      }
      kapat();
      yukle();
    } catch {
      setFormHata("Sunucuya ulaşılamadı");
    } finally {
      setKaydediliyor(false);
    }
  }

  async function sil(g: Gorev) {
    if (!window.confirm(`"${g.baslik}" görevi silinsin mi?`)) return;
    const yanit = await fetch(`/api/gorevler/${g.id}`, { method: "DELETE" });
    if (yanit.ok) yukle();
    else {
      const j = await yanit.json().catch(() => null);
      setHata(j?.hata ?? "Silme başarısız oldu");
    }
  }

  const salt = duzenlenen ? !duzenleyebilir(duzenlenen) : false;

  function aksiyonSinifi(tur: "ilerle" | "onay" | "red") {
    if (tur === "red") return "bg-red-600 hover:bg-red-700";
    if (tur === "onay") return "bg-emerald-600 hover:bg-emerald-700";
    return "bg-sky-600 hover:bg-sky-700";
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Görevler</h1>
          <p className="mt-1 text-sm text-slate-500">
            Atanan tamamlar → kontrolör onaylar → denetçi onaylar → atayana bildirim gider
          </p>
        </div>
        <button
          onClick={yeniAc}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
        >
          <Plus size={17} />
          Yeni Görev
        </button>
      </div>

      {hata && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{hata}</p>}

      {yukleniyor ? (
        <p className="mt-6 text-slate-500">Yükleniyor…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kolonlar.map((kolon) => {
            const kolonGorevleri = gorevler.filter((g) => kolon.durumlar.includes(g.durum));
            return (
              <div
                key={kolon.anahtar}
                className={`rounded-xl border border-slate-200 border-t-4 bg-slate-50 ${kolon.ust}`}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-700">{kolon.baslik}</h2>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                    {kolonGorevleri.length}
                  </span>
                </div>

                <div className="flex min-h-40 flex-col gap-2.5 p-3 pt-0">
                  {kolonGorevleri.length === 0 && (
                    <p className="rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                      Görev yok
                    </p>
                  )}
                  {kolonGorevleri.map((g) => {
                    const atananlar = atananlarDan(g, "atanan");
                    const denetci = atananlarDan(g, "denetci")[0];
                    const kontrolor = atananlarDan(g, "kontrolor")[0];
                    const izleyiciler = atananlarDan(g, "izleyici");
                    const akts = aksiyonlar(g);
                    const sonucVar = g.ekler.some((e) => e.tur === "sonuc");
                    return (
                      <div
                        key={g.id}
                        className="group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => ac(g)}
                            className={`text-left text-sm font-medium hover:text-sky-700 ${
                              g.durum === "tamamlandi" ? "text-slate-400 line-through" : "text-slate-800"
                            }`}
                          >
                            {g.baslik}
                          </button>
                          {g.oncelik && oncelikler[g.oncelik] && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${oncelikler[g.oncelik].sinif}`}>
                              {oncelikler[g.oncelik].etiket}
                            </span>
                          )}
                        </div>

                        {durumEtiketi[g.durum] && (
                          <span className="mt-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            {durumEtiketi[g.durum]}
                          </span>
                        )}

                        {g.durum === "devam_ediyor" && g.redNotu && (
                          <p className="mt-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-600">
                            Reddedildi: {g.redNotu}
                          </p>
                        )}

                        {g.aciklama && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{g.aciklama}</p>
                        )}

                        <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                          <span className="flex items-start gap-1.5">
                            <Users size={13} className="mt-0.5 shrink-0 text-slate-400" />
                            <span>{atananlar.length > 0 ? atananlar.map((k) => k.adSoyad).join(", ") : "Atanmamış"}</span>
                          </span>
                          {kontrolor && (
                            <span className="flex items-center gap-1.5">
                              <Eye size={13} className="shrink-0 text-amber-500" />
                              Kontrolör: {kontrolor.adSoyad}
                            </span>
                          )}
                          {denetci && (
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck size={13} className="shrink-0 text-emerald-500" />
                              Denetçi: {denetci.adSoyad}
                            </span>
                          )}
                          {izleyiciler.length > 0 && (
                            <span className="flex items-start gap-1.5">
                              <Eye size={13} className="mt-0.5 shrink-0 text-slate-400" />
                              İzleyici: {izleyiciler.map((k) => k.adSoyad).join(", ")}
                            </span>
                          )}
                          <span className="flex flex-wrap items-center gap-x-3 text-slate-400">
                            {g.makine && <span>⚙️ {g.makine.ad}</span>}
                            {g.bitis && <span>📅 {tarihGoster(g.bitis)}</span>}
                            {g.ekler.length > 0 && (
                              <span className="flex items-center gap-0.5" title={`${g.ekler.length} belge`}>
                                <Paperclip size={12} />
                                {g.ekler.length}
                                {sonucVar && <span className="text-emerald-500">✓</span>}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* İş akışı aksiyonları */}
                        {akts.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {akts.map((a) => (
                              <button
                                key={a.islem + a.etiket}
                                onClick={() => islemYap(g, a.islem)}
                                disabled={islemMesgul === g.id}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-white transition-colors disabled:opacity-60 ${aksiyonSinifi(a.tur)}`}
                              >
                                {a.tur === "ilerle" && <Play size={12} />}
                                {a.tur === "onay" && <CheckCircle2 size={12} />}
                                {a.tur === "red" && <XCircle size={12} />}
                                {a.etiket}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                          <button
                            onClick={() => ac(g)}
                            className="text-xs text-slate-400 hover:text-sky-700"
                          >
                            {duzenleyebilir(g) ? "Aç / Düzenle" : "Detay"}
                          </button>
                          {duzenleyebilir(g) && (
                            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => ac(g)}
                                title="Düzenle"
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => sil(g)}
                                title="Sil"
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <Modal
          baslik={
            !duzenlenen ? "Yeni Görev" : salt ? "Görev Detayı" : "Görevi Düzenle"
          }
          kapat={kapat}
          genis
        >
          {salt && (
            <p className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <Lock size={14} className="shrink-0" />
              Bu görevi yalnızca atayan ({duzenlenen?.olusturan?.adSoyad ?? "—"}) düzenleyebilir.
              Aşağıdaki alanlar salt-okunurdur; siz belge ekleyip iş akışı işlemlerini yapabilirsiniz.
            </p>
          )}

          {/* İş akışı aksiyonları modal içinde de */}
          {duzenlenen && aksiyonlar(duzenlenen).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {aksiyonlar(duzenlenen).map((a) => (
                <button
                  key={a.islem + a.etiket}
                  type="button"
                  onClick={() => islemYap(duzenlenen, a.islem)}
                  disabled={islemMesgul === duzenlenen.id}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 ${aksiyonSinifi(a.tur)}`}
                >
                  {a.tur === "ilerle" && <Play size={15} />}
                  {a.tur === "onay" && <CheckCircle2 size={15} />}
                  {a.tur === "red" && <XCircle size={15} />}
                  {a.etiket}
                </button>
              ))}
            </div>
          )}

          {duzenlenen && duzenlenen.durum === "devam_ediyor" && duzenlenen.redNotu && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              Reddedildi: {duzenlenen.redNotu}
            </p>
          )}

          <form onSubmit={kaydet} className="space-y-4">
            <div>
              <label htmlFor="baslik" className={etiketSinifi}>
                Başlık <span className="text-red-500">*</span>
              </label>
              <input
                id="baslik"
                required
                disabled={salt}
                value={form.baslik}
                onChange={(e) => setForm({ ...form, baslik: e.target.value })}
                className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-500`}
                placeholder="Örn: 20 adet sandalye iskeleti kesimi"
              />
            </div>

            <div>
              <label htmlFor="aciklama" className={etiketSinifi}>Açıklama</label>
              <textarea
                id="aciklama"
                rows={2}
                disabled={salt}
                value={form.aciklama}
                onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
                className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-500`}
              />
            </div>

            <div>
              <label className={etiketSinifi}>
                Atanan Kullanıcılar
                <span className="ml-1 font-normal text-slate-400">(giriş bilgisi olan kullanıcılar)</span>
              </label>
              {kullanicilar.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Görev atanabilecek panel kullanıcısı yok.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {kullanicilar.map((k) => (
                    <label
                      key={k.id}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${salt ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-slate-50"}`}
                    >
                      <input
                        type="checkbox"
                        disabled={salt}
                        checked={form.atananlar.includes(k.id)}
                        onChange={() => atamaDegistir(k.id)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-slate-700">{k.adSoyad}</span>
                      {k.rol === "admin" && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">yönetici</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="denetciId" className={etiketSinifi}>Denetçi</label>
                <select
                  id="denetciId"
                  disabled={salt}
                  value={form.denetciId}
                  onChange={(e) => setForm({ ...form, denetciId: e.target.value })}
                  className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-500`}
                >
                  <option value="">Yok</option>
                  {kullanicilar.map((k) => (
                    <option key={k.id} value={k.id}>{k.adSoyad}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="kontrolorId" className={etiketSinifi}>Kontrolör</label>
                <select
                  id="kontrolorId"
                  disabled={salt}
                  value={form.kontrolorId}
                  onChange={(e) => setForm({ ...form, kontrolorId: e.target.value })}
                  className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-500`}
                >
                  <option value="">Yok</option>
                  {kullanicilar.map((k) => (
                    <option key={k.id} value={k.id}>{k.adSoyad}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={etiketSinifi}>
                Görevi Görebilecek Kullanıcılar (İzleyiciler)
                <span className="ml-1 font-normal text-slate-400">
                  yalnızca görüntüler, iş akışında rolü olmaz
                </span>
              </label>
              {kullanicilar.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Eklenebilecek panel kullanıcısı yok.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {kullanicilar.map((k) => (
                    <label
                      key={k.id}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${salt ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-slate-50"}`}
                    >
                      <input
                        type="checkbox"
                        disabled={salt}
                        checked={form.izleyiciler.includes(k.id)}
                        onChange={() => izleyiciDegistir(k.id)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-slate-700">{k.adSoyad}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="makineId" className={etiketSinifi}>Makine</label>
                <select
                  id="makineId"
                  disabled={salt}
                  value={form.makineId}
                  onChange={(e) => setForm({ ...form, makineId: e.target.value })}
                  className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-500`}
                >
                  <option value="">Yok</option>
                  {makineler.map((m) => (
                    <option key={m.id} value={m.id}>{m.ad}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="oncelik" className={etiketSinifi}>Öncelik</label>
                <select
                  id="oncelik"
                  disabled={salt}
                  value={form.oncelik}
                  onChange={(e) => setForm({ ...form, oncelik: e.target.value })}
                  className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-500`}
                >
                  <option value="dusuk">Düşük</option>
                  <option value="normal">Normal</option>
                  <option value="yuksek">Yüksek</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="baslangic" className={etiketSinifi}>Başlangıç</label>
                <input
                  id="baslangic"
                  type="date"
                  disabled={salt}
                  value={form.baslangic}
                  onChange={(e) => setForm({ ...form, baslangic: e.target.value })}
                  className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-500`}
                />
              </div>
              <div>
                <label htmlFor="bitis" className={etiketSinifi}>Bitiş</label>
                <input
                  id="bitis"
                  type="date"
                  disabled={salt}
                  value={form.bitis}
                  onChange={(e) => setForm({ ...form, bitis: e.target.value })}
                  className={`${girdiSinifi} disabled:bg-slate-50 disabled:text-slate-500`}
                />
              </div>
            </div>

            {/* Belgeler */}
            {duzenlenen ? (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <BelgeBolumu
                  baslik="Görev Belgeleri"
                  aciklama="Göreve iliştirilen belgeler (ör. gönderilen ürün/çizim/istek)"
                  ekler={ekler.filter((e) => e.tur === "gorev")}
                  onYukle={(d) => ekYukle(duzenlenen.id, "gorev", d)}
                  onSil={(ekId) => ekSil(duzenlenen.id, ekId)}
                  gorevId={duzenlenen.id}
                  mesgul={ekMesgul}
                  silebilir={!salt}
                />
                <BelgeBolumu
                  baslik="Sonuç / Tamamlama Belgeleri"
                  aciklama="Görevi tamamlayanın eklediği çıktı (ör. çalışılmış reçete)"
                  ekler={ekler.filter((e) => e.tur === "sonuc")}
                  onYukle={(d) => ekYukle(duzenlenen.id, "sonuc", d)}
                  onSil={(ekId) => ekSil(duzenlenen.id, ekId)}
                  gorevId={duzenlenen.id}
                  mesgul={ekMesgul}
                  silebilir={!salt}
                  vurgu
                />
                {ekHata && <p className="text-xs text-red-600">{ekHata}</p>}
              </div>
            ) : (
              <div>
                <label className={etiketSinifi}>Görev Belgeleri (isteğe bağlı)</label>
                <input
                  type="file"
                  multiple
                  accept={EK_KABUL}
                  onChange={(e) => {
                    const secilen = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (secilen.length > 0) setEkDosyalar((o) => [...o, ...secilen].slice(0, 10));
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-200"
                />
                {ekDosyalar.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {ekDosyalar.map((d, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
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
                  Kaydedince otomatik yüklenir. Sonuç belgeleri görevi tamamlayan tarafından sonradan eklenir.
                </p>
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
                {salt ? "Kapat" : "Vazgeç"}
              </button>
              {!salt && (
                <button
                  type="submit"
                  disabled={kaydediliyor}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
                >
                  {kaydediliyor ? "Kaydediliyor…" : duzenlenen ? "Güncelle" : "Ekle"}
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Görev/sonuç belgeleri için ortak yükleme + liste bölümü
function BelgeBolumu({
  baslik,
  aciklama,
  ekler,
  gorevId,
  onYukle,
  onSil,
  mesgul,
  silebilir = false,
  vurgu = false,
}: {
  baslik: string;
  aciklama: string;
  ekler: Ek[];
  gorevId: number;
  onYukle: (dosya: File) => void;
  onSil: (ekId: number) => void;
  mesgul: boolean;
  silebilir?: boolean;
  vurgu?: boolean;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-sm font-medium ${vurgu ? "text-emerald-700" : "text-slate-700"}`}>{baslik}</p>
          <p className="text-xs text-slate-400">{aciklama}</p>
        </div>
        <label
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
            vurgu ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Upload size={13} />
          Belge Ekle
          <input
            type="file"
            className="hidden"
            accept={EK_KABUL}
            disabled={mesgul}
            onChange={(e) => {
              const d = e.target.files?.[0];
              e.target.value = "";
              if (d) onYukle(d);
            }}
          />
        </label>
      </div>
      {ekler.length === 0 ? (
        <p className="mt-1.5 rounded-md border border-dashed border-slate-200 px-2 py-2 text-center text-xs text-slate-400">
          Belge yok
        </p>
      ) : (
        <ul className="mt-1.5 divide-y divide-slate-100 rounded-md border border-slate-200">
          {ekler.map((ek) => (
            <li key={ek.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
              <Paperclip size={12} className="shrink-0 text-slate-400" />
              <span className="truncate text-slate-700">{ek.dosyaAd}</span>
              <span className="shrink-0 text-slate-400">{boyutGoster(ek.boyut)}</span>
              <a
                href={`/api/gorevler/${gorevId}/ekler/${ek.id}?goster=1`}
                target="_blank"
                rel="noopener noreferrer"
                title="Görüntüle / indir"
                className="ml-auto shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <Download size={13} />
              </a>
              {silebilir && (
                <button
                  type="button"
                  onClick={() => onSil(ek.id)}
                  title="Sil (yalnızca görevi oluşturan)"
                  className="shrink-0 rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
