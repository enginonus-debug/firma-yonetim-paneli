"use client";

import { useState } from "react";
import { Check, KeyRound } from "lucide-react";
import { etiketSinifi, girdiSinifi } from "@/lib/format";

export default function SifreSayfasi() {
  const [form, setForm] = useState({ eskiSifre: "", yeniSifre: "", yeniSifreTekrar: "" });
  const [hata, setHata] = useState("");
  const [basarili, setBasarili] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    setBasarili(false);
    if (form.yeniSifre !== form.yeniSifreTekrar) {
      setHata("Yeni şifreler birbiriyle uyuşmuyor");
      return;
    }
    setGonderiliyor(true);
    try {
      const y = await fetch("/api/hesap/sifre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eskiSifre: form.eskiSifre, yeniSifre: form.yeniSifre }),
      });
      if (!y.ok) {
        setHata((await y.json().catch(() => null))?.hata ?? "İşlem başarısız oldu");
        return;
      }
      setBasarili(true);
      setForm({ eskiSifre: "", yeniSifre: "", yeniSifreTekrar: "" });
    } catch {
      setHata("Sunucuya ulaşılamadı");
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Şifre Değiştir</h1>
      <p className="mt-1 text-sm text-slate-500">Hesabınızın giriş şifresini güncelleyin</p>

      <div className="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-sky-100 p-2.5 text-sky-600">
            <KeyRound size={22} />
          </div>
          <p className="text-xs text-slate-400">
            Şifre en az 6 karakter olmalı. Değişiklik hemen geçerli olur.
          </p>
        </div>

        <form onSubmit={gonder} className="space-y-4">
          <div>
            <label className={etiketSinifi}>
              Mevcut Şifre <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="password"
              value={form.eskiSifre}
              onChange={(e) => setForm({ ...form, eskiSifre: e.target.value })}
              className={girdiSinifi}
            />
          </div>
          <div>
            <label className={etiketSinifi}>
              Yeni Şifre <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="password"
              minLength={6}
              value={form.yeniSifre}
              onChange={(e) => setForm({ ...form, yeniSifre: e.target.value })}
              className={girdiSinifi}
            />
          </div>
          <div>
            <label className={etiketSinifi}>
              Yeni Şifre (Tekrar) <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="password"
              minLength={6}
              value={form.yeniSifreTekrar}
              onChange={(e) => setForm({ ...form, yeniSifreTekrar: e.target.value })}
              className={girdiSinifi}
            />
          </div>

          {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>}

          <div className="flex items-center justify-end gap-3 pt-1">
            {basarili && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <Check size={16} />
                Şifre güncellendi
              </span>
            )}
            <button
              type="submit"
              disabled={gonderiliyor}
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
            >
              {gonderiliyor ? "Kaydediliyor…" : "Şifreyi Değiştir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
