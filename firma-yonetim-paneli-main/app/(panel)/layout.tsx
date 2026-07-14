import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { aktifKullanici, izinSeviyesi, MODULLER, type IzinHaritasi } from "@/lib/yetki";
import Sidebar from "@/components/Sidebar";
import AskidaEkrani from "@/components/AskidaEkrani";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware zaten koruyor; burada ikinci bir güvenlik katmanı
  const oturum = await auth();
  if (!oturum?.user) redirect("/giris");

  // İzinler/aktiflik her sayfa yüklemesinde veritabanından taze okunur
  const kullanici = await aktifKullanici();
  if (!kullanici) return <AskidaEkrani />;

  const izinler: IzinHaritasi = Object.fromEntries(
    MODULLER.map((m) => [m, izinSeviyesi(kullanici, m)])
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar
        kullaniciAdi={kullanici.adSoyad}
        rol={kullanici.rol}
        izinler={izinler}
      />
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
