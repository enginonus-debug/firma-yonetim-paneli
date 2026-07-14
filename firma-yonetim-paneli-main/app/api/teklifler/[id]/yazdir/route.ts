import { prisma } from "@/lib/db";
import { yetki } from "@/lib/yetki";
import { hata, idAl } from "@/lib/api";
import type { TeklifAnlikVeri, TeklifKalem } from "@/lib/teklif";

// GET /api/teklifler/:id/yazdir — teklifi bağımsız, yazdırılabilir HTML belgesi
// olarak döndürür. Tarayıcıdan "PDF olarak kaydet" ile PDF, "sayfayı kaydet" ile
// HTML çıktısı alınabilir (herhangi bir formata aktarım).
export async function GET(_istek: Request, baglam: { params: Promise<{ id: string }> }) {
  const y = await yetki("musteriler", "okuma");
  if (y.yanit) return y.yanit;
  const firmaId = y.firmaId;

  const id = idAl((await baglam.params).id);
  if (!id) return hata("Geçersiz id");

  const teklif = await prisma.teklif.findFirst({
    where: { id, firmaId },
    include: {
      satisFirsati: { select: { musteri: { select: { ad: true, adres: true, vergiNo: true, telefon: true } } } },
      onaylayan: { select: { adSoyad: true } },
      olusturan: { select: { adSoyad: true } },
    },
  });
  if (!teklif) return hata("Teklif bulunamadı", 404);

  // Karara bağlanmış teklif, karar anında dondurulan kopyadan (anlikVeri) beslenir;
  // firma/müşteri bilgileri sonradan değişse bile onaylı belge değişmez.
  const anlik = (teklif.anlikVeri as TeklifAnlikVeri | null) ?? null;
  const firma = anlik?.firma ?? (await prisma.firma.findUnique({ where: { id: firmaId } }));
  const musteri = anlik?.musteri ?? teklif.satisFirsati.musteri;
  const olusturanAd = anlik ? anlik.olusturanAd : (teklif.olusturan?.adSoyad ?? null);
  const onaylayanAd = anlik ? anlik.onaylayanAd : (teklif.onaylayan?.adSoyad ?? null);
  const kalemler = (teklif.kalemler as unknown as TeklifKalem[]) ?? [];

  const tl = (n: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
  const tarih = (d: Date | null) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");
  const kac = (s: string | null | undefined) =>
    (s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
    );

  const durumEtiket: Record<string, string> = {
    onay_bekliyor: "Onay Bekliyor",
    onaylandi: "Onaylandı",
    reddedildi: "Reddedildi",
  };

  const satirlar = kalemler
    .map((k, i) => {
      const tutar = k.miktar * k.birimFiyat;
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${kac(k.aciklama)}</td>
        <td class="r">${k.miktar}</td>
        <td class="c">${kac(k.birim)}</td>
        <td class="r">${tl(k.birimFiyat)}</td>
        <td class="r">${tl(tutar)}</td>
      </tr>`;
    })
    .join("");

  const araToplam = Number(teklif.araToplam);
  const kdvOrani = Number(teklif.kdvOrani);
  const iskontoOrani = Number(teklif.iskontoOrani);
  const iskontoTutar = Math.round(araToplam * iskontoOrani) / 100;
  const kdvTutar = Number(teklif.toplam) - (araToplam - iskontoTutar);

  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Teklif #${teklif.id} — ${kac(teklif.baslik)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px; font-size: 13px; }
  .ust { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0284c7; padding-bottom: 16px; gap: 24px; }
  .firma { display: flex; gap: 14px; align-items: flex-start; }
  .logo { max-height: 72px; max-width: 180px; object-fit: contain; }
  .sag { text-align: right; white-space: nowrap; }
  .firma-ad { font-size: 22px; font-weight: 700; color: #0f172a; }
  .kucuk { color: #64748b; font-size: 12px; line-height: 1.5; }
  .rozet { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .b-onay_bekliyor { background: #fef9c3; color: #854d0e; }
  .b-onaylandi { background: #dcfce7; color: #166534; }
  .b-reddedildi { background: #fee2e2; color: #991b1b; }
  h1 { font-size: 18px; margin: 24px 0 4px; }
  .kutular { display: flex; gap: 24px; margin: 16px 0; }
  .kutu { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .kutu h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-size: 12px; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  td.r, th.r { text-align: right; }
  td.c, th.c { text-align: center; }
  .toplamlar { margin-top: 12px; margin-left: auto; width: 300px; }
  .toplamlar div { display: flex; justify-content: space-between; padding: 6px 0; }
  .genel { border-top: 2px solid #0f172a; font-weight: 700; font-size: 15px; }
  .notlar { margin-top: 20px; background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 14px; white-space: pre-wrap; }
  .yazdir-btn { position: fixed; bottom: 16px; right: 16px; background: #0284c7; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; box-shadow: 0 4px 12px rgba(2,132,199,.35); }
  @media print { .yazdir-btn { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <button class="yazdir-btn" onclick="window.print()">Yazdır / PDF olarak kaydet</button>
  <div class="ust">
    <div class="firma">
      ${firma?.logo ? `<img class="logo" src="${firma.logo}" alt="logo" />` : ""}
      <div>
        <div class="firma-ad">${kac(firma?.ad ?? "Firma")}</div>
        <div class="kucuk">
          ${kac(firma?.adres ?? "")}<br/>
          ${firma?.telefon ? "Tel: " + kac(firma.telefon) + "<br/>" : ""}
          ${firma?.vergiNo ? "Vergi No: " + kac(firma.vergiNo) : ""}
        </div>
      </div>
    </div>
    <div class="sag">
      <div style="font-size:20px;font-weight:700">FİYAT TEKLİFİ</div>
      <div class="kucuk">Teklif No: #${teklif.id}${teklif.revizyonNo > 0 ? ` · Revizyon ${teklif.revizyonNo}` : ""}<br/>Tarih: ${tarih(teklif.olusturma)}</div>
      <div style="margin-top:8px" class="rozet b-${teklif.durum}">${durumEtiket[teklif.durum] ?? teklif.durum}</div>
    </div>
  </div>

  <h1>${kac(teklif.baslik)}</h1>

  <div class="kutular">
    <div class="kutu">
      <h3>Müşteri</h3>
      <strong>${kac(musteri.ad)}</strong><br/>
      <span class="kucuk">
        ${kac(musteri.adres ?? "")}${musteri.adres ? "<br/>" : ""}
        ${musteri.telefon ? "Tel: " + kac(musteri.telefon) + "<br/>" : ""}
        ${musteri.vergiNo ? "Vergi No: " + kac(musteri.vergiNo) : ""}
      </span>
    </div>
    <div class="kutu">
      <h3>Teklif Bilgileri</h3>
      <span class="kucuk">
        Geçerlilik: ${tarih(teklif.gecerlilikTarihi)}<br/>
        Hazırlayan: ${kac(olusturanAd ?? "—")}<br/>
        Onaylayan: ${kac(onaylayanAd ?? "—")}
      </span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="c">#</th>
        <th>Açıklama</th>
        <th class="r">Miktar</th>
        <th class="c">Birim</th>
        <th class="r">Birim Fiyat</th>
        <th class="r">Tutar</th>
      </tr>
    </thead>
    <tbody>${satirlar}</tbody>
  </table>

  <div class="toplamlar">
    <div><span>Ara Toplam</span><span>${tl(araToplam)}</span></div>
    ${iskontoOrani > 0 ? `<div><span>İskonto (%${iskontoOrani})</span><span>−${tl(iskontoTutar)}</span></div>` : ""}
    <div><span>KDV (%${kdvOrani})</span><span>${tl(kdvTutar)}</span></div>
    <div class="genel"><span>Genel Toplam</span><span>${tl(Number(teklif.toplam))}</span></div>
  </div>

  ${teklif.notlar ? `<div class="notlar"><strong>Notlar:</strong>\n${kac(teklif.notlar)}</div>` : ""}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
