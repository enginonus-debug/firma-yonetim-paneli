# Firma Yönetim Paneli

Küçük üretim işletmeleri (başlangıçta mobilya atölyeleri hedeflenerek) için geliştirilmiş bir işletme yönetim paneli. Firma bilgileri, çalışan yönetimi, makine/ekipman takibi, günlük devam (puantaj), görev atama/takip, satış-pazarlama takibi ve tahsilat bilgisini tek yerde toplar.

> Proje kodu [`firma-yonetim-paneli-main/`](firma-yonetim-paneli-main/) klasöründedir. Detaylı ürün tasarımı için [proje-brief.md](firma-yonetim-paneli-main/proje-brief.md) dosyasına bakın.

## Modüller

- **Dashboard** — açık görevler, bugünkü devam durumu, bekleyen tahsilatların özeti
- **Firma bilgileri** — ad, adres, telefon, vergi no
- **Çalışanlar** — ekle/düzenle/pasife al, toplu ekleme
- **Makineler/Ekipman** — durum takibi (çalışıyor / bakımda / arızalı), olay geçmişi
- **Devam/Puantaj** — günlük giriş-çıkış, aylık devamsızlık raporu
- **Görevler** — kanban görünümü, çalışana/makineye atama, dosya ekleri
- **Müşteriler ve satış fırsatları** — potansiyel → görüşülüyor → kazanıldı/kaybedildi akışı
- **Teklifler** — teklif hazırlama, onay/karar süreci, yazdırma
- **Tahsilatlar** — açık borç, vade tarihi, gecikenleri vurgulayan görünüm
- **Kullanıcı yönetimi** — rol ve izin bazlı yetkilendirme, denetim kaydı

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Frontend + API | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| ORM | Prisma 6 |
| Veritabanı | PostgreSQL |
| Kimlik doğrulama | Auth.js (next-auth v5), bcryptjs |
| Doğrulama | Zod |

## Kurulum

### Gereksinimler

- Node.js 20+
- PostgreSQL 17 (yerelde çalışan bir sunucu)

### Adımlar

1. **Depoyu klonlayın ve proje klasörüne geçin:**

   ```bash
   git clone https://github.com/enginonus-debug/firma-yonetim-paneli.git
   cd firma-yonetim-paneli/firma-yonetim-paneli-main
   ```

2. **Bağımlılıkları yükleyin:**

   ```bash
   npm install
   ```

3. **Ortam değişkenlerini ayarlayın** — `.env.example` dosyasını `.env` olarak kopyalayıp kendi değerlerinizi girin:

   ```bash
   # Windows (PowerShell)
   Copy-Item .env.example .env

   # macOS / Linux
   cp .env.example .env
   ```

   | Değişken | Açıklama |
   |---|---|
   | `DATABASE_URL` | PostgreSQL bağlantı adresi |
   | `SHADOW_DATABASE_URL` | Yalnızca `prisma migrate dev` için kullanılan gölge veritabanı |
   | `AUTH_SECRET` | Oturum imzalama anahtarı — üretmek için: `openssl rand -base64 32` |

4. **Veritabanını hazırlayın** (tabloları oluşturur ve örnek verileri yükler):

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Geliştirme sunucusunu başlatın:**

   ```bash
   npm run dev
   ```

   Uygulama http://localhost:3000 adresinde açılır. Windows'ta alternatif olarak `sunucuyu-baslat.bat` dosyasını da çalıştırabilirsiniz.

### Varsayılan Giriş Bilgileri

Seed verisi iki kullanıcı oluşturur:

| Kullanıcı | Şifre | Rol |
|---|---|---|
| `admin` | `admin123` | Süper admin (ürün sahibi) |
| `demo` | `demo123` | Örnek firma admini |

> ⚠️ Gerçek bir ortamda kullanmadan önce bu şifreleri mutlaka değiştirin (`scripts/admin-guncelle.ts` yardımcı betiği kullanılabilir).

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusunu başlatır |
| `npm run build` | Üretim derlemesi alır |
| `npm run start` | Üretim sunucusunu başlatır |
| `npm run db:migrate` | Veritabanı migrasyonlarını uygular |
| `npm run db:seed` | Örnek verileri yükler |
| `npm run db:studio` | Prisma Studio'yu açar (veritabanı arayüzü) |

## Yol Haritası

- **Aşama 1 (mevcut):** Tek firma (single-tenant), web arayüzü
- **Aşama 2:** Çoklu firma (SaaS) modeli
- **Aşama 3:** Devam, satış/pazarlama ve tahsilat modülleri için mobil erişim (PWA / native)
