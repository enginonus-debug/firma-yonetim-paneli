"use client";

import { X } from "lucide-react";

export default function Modal({
  baslik,
  kapat,
  genis = false,
  children,
}: {
  baslik: string;
  kapat: () => void;
  genis?: boolean;
  children: React.ReactNode;
}) {
  return (
    // Boşluğa tıklayınca kapanmaz; yalnızca kapat (X) butonuyla kapatılır.
    // Böylece yanlışlıkla tıklamada form verisi kaybolmaz.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className={`max-h-[90vh] w-full ${
          genis ? "max-w-lg" : "max-w-md"
        } overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{baslik}</h2>
          <button
            onClick={kapat}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
