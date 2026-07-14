# Küçük Üretim İşletmeleri için Yönetim Paneli — Proje Brief'i

## 1. Ürün özeti

Küçük üretim işletmeleri (başlangıçta mobilyacılar hedefleniyor) için basit, hızlı kurulan bir işletme yönetim paneli. Firma bilgileri, çalışan yönetimi, makine/ekipman takibi, günlük devam (puantaj), görev atama/takip, satış-pazarlama takibi ve tahsilat bilgisini tek yerde toplar.

Aşamalı yol haritası:

- **Aşama 1 (şimdi):** Tek firma (single-tenant) olarak geliştirilecek, web arayüzü.
- **Aşama 2 (ileride):** Çoklu firma (SaaS) modeline dönüştürülecek.
- **Aşama 3 (ileride):** Devam, satış/pazarlama ve tahsilat modülleri için mobil erişim (native app veya PWA) eklenecek.

Bu brief, ileriki aşamaları göz önünde bulundurarak Aşama 1'i tasarlar — böylece sonradan büyük bir yeniden yazım gerekmez.

## 2. Kapsam / modüller

1. **Firma bilgileri** — tek kayıt, düzenlenebilir ayarlar sayfası (ad, adres, telefon, vergi no)
2. **Çalışan yönetimi** — liste + ekle/düzenle/pasife al
3. **Makine/ekipman yönetimi** — liste + durum (çalışıyor / bakımda / arızalı)
4. **Devam/puantaj** — günlük giriş-çıkış kaydı, aylık devamsızlık raporu
5. **Görev atama ve takip** — görev oluştur, çalışana (ve isteğe bağlı olarak makineye) ata, durumunu güncelle (bekliyor / devam ediyor / tamamlandı)
6. **Satış/pazarlama takibi** — müşteri kayıtları + satış fırsatları (potansiyel → görüşülüyor → kazanıldı/kaybedildi)
7. **Tahsilat takibi** — müşteriye açık borç, vade tarihi, tahsil durumu (bekliyor / tahsil edildi / gecikti)

## 3. Mimari kararlar

- **Single-tenant, SaaS'a hazır:** Tablolara `firmaId` alanı eklenir (varsayılan: 1). Şimdilik tüm veriler tek firmaya ait olacak, ama ileride çoklu firma desteğine geçişte şema değişmeyecek — sadece auth katmanı ve sorgu filtrelemesi eklenecek.
- **API-first backend:** İş mantığı API route'larında (düz JSON dönen uçlar) yer alır, sayfa bileşenlerine gömülmez. Böylece ileride yazılacak mobil uygulama veya PWA aynı API'yi kullanabilir.
- **Mobil öncelikli modüller:** Devam/puantaj, satış/pazarlama, tahsilat — bu üç modülün API uçları sade ve mobil-dostu tasarlanmalı (küçük payload, sayfalama, basit filtreler).

## 4. Teknoloji yığını

- **Frontend + API:** Next.js (App Router)
- **ORM:** Prisma
- **Veritabanı:** PostgreSQL (geliştirmede yerel Prisma Postgres — `npx prisma dev`; üretimde Supabase veya Neon)
- **Auth:** Basit e-posta/şifre girişi (Auth.js / next-auth v5), ileride çoklu firma girişine genişletilecek şekilde tasarlanmalı

## 5. Ekranlar

1. **Dashboard** — özet (açık görevler, bugünkü devam durumu, bekleyen tahsilatlar)
2. **Firma bilgileri** — ayarlar sayfası
3. **Çalışanlar** — liste, ekle/düzenle
4. **Makineler/Ekipman** — liste, durum güncelleme
5. **Devam/Puantaj** — günlük giriş-çıkış girişi, aylık rapor
6. **Görevler** — kanban görünümü (bekliyor / devam ediyor / tamamlandı)
7. **Müşteriler ve satış fırsatları** — liste + fırsat durumu güncelleme
8. **Tahsilatlar** — liste, vadesi geçenleri vurgulayan görünüm

## 6. İleriye dönük notlar

- **SaaS'a geçişte:** `firmaId` filtrelemesi her API route'unda oturumdan alınmalı, istek gövdesinden/URL'den asla güvenilmemeli (kiracılar arası veri sızıntısını önlemek için). Kod tarafında bunun için tek nokta hazır: `lib/api.ts` içindeki `FIRMA_ID` sabiti.
- **Mobil uygulama/PWA'ya geçişte:** Aşama 1'de kurulan API route'ları büyük ölçüde yeniden kullanılabilir olmalı; sadece kimlik doğrulama token yönetimi mobil istemciye göre uyarlanmalı.
- **Ödeme/abonelik entegrasyonu** (Stripe vb.) SaaS aşamasına kadar ertelenebilir; başlangıçta `abonelikDurumu` gibi bir alan manuel yönetilebilir.

## 7. Veri modeli

Güncel şema için `prisma/schema.prisma` dosyasına bakın. Brief'teki taslaktan farklar:

- `Kullanici` modeli eklendi (panel girişi için; çalışanlardan ayrı).
- `Calisan.aktif` alanı eklendi ("pasife al" özelliği için).
- `Devam` ve `Tahsilat` tablolarına da `firmaId` eklendi (tutarlılık için).
- Parasal alanlar `Float` yerine `Decimal(12,2)` (yuvarlama hatalarını önlemek için).
- `SatisFirsati.baslik` alanı eklendi (fırsatı adlandırmak için).
- Durum/tarih sorguları için indeksler ve `Devam` için `(calisanId, tarih)` benzersizlik kısıtı eklendi.
