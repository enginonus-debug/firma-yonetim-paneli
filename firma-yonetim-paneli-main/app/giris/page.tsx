"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Building2 } from "lucide-react";

export default function GirisSayfasi() {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function girisYap(e: React.FormEvent) {
    e.preventDefault();
    setHata("");
    setGonderiliyor(true);

    const sonuc = await signIn("credentials", { redirect: false, email, sifre });

    if (sonuc?.error) {
      setHata("Kullanıcı adı veya şifre hatalı");
      setGonderiliyor(false);
    } else {
      window.location.href = "/";
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex rounded-xl bg-sky-100 p-3 text-sky-600">
            <Building2 size={28} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Firma Yönetim Paneli</h1>
          <p className="mt-1 text-sm text-slate-500">Devam etmek için giriş yapın</p>
        </div>

        <form onSubmit={girisYap} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Kullanıcı Adı
            </label>
            <input
              id="email"
              type="text"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              placeholder="admin"
            />
          </div>

          <div>
            <label htmlFor="sifre" className="mb-1 block text-sm font-medium text-slate-700">
              Şifre
            </label>
            <input
              id="sifre"
              type="password"
              required
              autoComplete="current-password"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              placeholder="••••••••"
            />
          </div>

          {hata && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{hata}</p>
          )}

          <button
            type="submit"
            disabled={gonderiliyor}
            className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
          >
            {gonderiliyor ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
