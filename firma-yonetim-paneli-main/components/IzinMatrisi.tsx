"use client";

// Kullanıcı ekleme/düzenleme formlarında modül bazlı izin seçimi.
// Anahtarlar lib/yetki.ts'deki MODULLER ile aynıdır.
export const IZIN_MODULLERI = [
  { anahtar: "calisanlar", etiket: "Çalışanlar" },
  { anahtar: "makineler", etiket: "Makineler" },
  { anahtar: "devam", etiket: "Devam / Puantaj" },
  { anahtar: "gorevler", etiket: "Görevler" },
  { anahtar: "musteriler", etiket: "Müşteriler & Satış" },
  { anahtar: "tahsilatlar", etiket: "Tahsilatlar" },
  { anahtar: "firma", etiket: "Firma Bilgileri" },
] as const;

export const IZIN_SECENEKLERI = [
  { deger: "yok", etiket: "Yok" },
  { deger: "okuma", etiket: "Görüntüleme" },
  { deger: "yazma", etiket: "Düzenleme" },
] as const;

export type IzinlerFormu = Record<string, string>;

export const bosIzinler: IzinlerFormu = Object.fromEntries(
  IZIN_MODULLERI.map((m) => [m.anahtar, "yok"])
);

export default function IzinMatrisi({
  izinler,
  degistir,
}: {
  izinler: IzinlerFormu;
  degistir: (yeni: IzinlerFormu) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Ekran</th>
            {IZIN_SECENEKLERI.map((s) => (
              <th key={s.deger} className="px-2 py-2 text-center">
                {s.etiket}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {IZIN_MODULLERI.map((m) => (
            <tr key={m.anahtar}>
              <td className="px-3 py-2 font-medium text-slate-700">{m.etiket}</td>
              {IZIN_SECENEKLERI.map((s) => (
                <td key={s.deger} className="px-2 py-2 text-center">
                  <input
                    type="radio"
                    name={`izin-${m.anahtar}`}
                    aria-label={`${m.etiket}: ${s.etiket}`}
                    checked={(izinler[m.anahtar] ?? "yok") === s.deger}
                    onChange={() => degistir({ ...izinler, [m.anahtar]: s.deger })}
                    className="size-4 accent-sky-600"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
