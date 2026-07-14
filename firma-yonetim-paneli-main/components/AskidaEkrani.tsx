"use client";

import { signOut } from "next-auth/react";
import { ShieldAlert } from "lucide-react";

// Oturum çerezi geçerli ama hesap/firma askıya alınmışsa gösterilir
export default function AskidaEkrani() {
  async function cikisYap() {
    await signOut({ redirect: false });
    window.location.href = "/giris";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 inline-flex rounded-full bg-red-50 p-3 text-red-600">
          <ShieldAlert size={28} />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Hesap erişime kapalı</h1>
        <p className="mt-2 text-sm text-slate-500">
          Hesabınız veya firmanızın sistemi askıya alınmış. Lütfen yöneticinizle iletişime geçin.
        </p>
        <button
          onClick={cikisYap}
          className="mt-6 rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}
