import { redirect } from "next/navigation";
import { aktifKullanici } from "@/lib/yetki";
import KayitlarIstemci from "./KayitlarIstemci";

// İşlem (denetim) kayıtları — YALNIZCA admin görebilir.
// Sunucu tarafında rol denetlenir; admin olmayan panele geri yönlendirilir
// (API ucu da ayrıca 403 döndürür, bu ikinci güvenlik katmanıdır).
export default async function KayitlarSayfasi() {
  const kullanici = await aktifKullanici();
  if (!kullanici || (kullanici.rol !== "admin" && kullanici.rol !== "superadmin")) {
    redirect("/");
  }

  return <KayitlarIstemci superadmin={kullanici.rol === "superadmin"} />;
}
