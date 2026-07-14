// Ekranlarda ortak kullanılan biçimlendirme yardımcıları

export const para = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export function tarihGoster(t: string | null | undefined) {
  return t ? new Date(t).toLocaleDateString("tr-TR") : "—";
}

// Bugünün tarihi, yerel saat dilimine göre "YYYY-MM-DD"
export function bugunStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// İçinde bulunulan ay, "YYYY-MM"
export function buAyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Form girdileri için ortak Tailwind sınıfları
export const girdiSinifi =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
export const etiketSinifi = "mb-1 block text-sm font-medium text-slate-700";
