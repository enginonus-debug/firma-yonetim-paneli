"use client";

export default function Sayfalama({
  sayfa,
  toplam,
  limit,
  onDegis,
}: {
  sayfa: number;
  toplam: number;
  limit: number;
  onDegis: (yeniSayfa: number) => void;
}) {
  const toplamSayfa = Math.max(1, Math.ceil(toplam / limit));
  if (toplamSayfa <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
      <span>Toplam {toplam} kayıt</span>
      <div className="flex items-center gap-3">
        <button
          disabled={sayfa <= 1}
          onClick={() => onDegis(sayfa - 1)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          Önceki
        </button>
        <span>
          {sayfa} / {toplamSayfa}
        </span>
        <button
          disabled={sayfa >= toplamSayfa}
          onClick={() => onDegis(sayfa + 1)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          Sonraki
        </button>
      </div>
    </div>
  );
}
