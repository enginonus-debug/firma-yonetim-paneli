"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Banknote,
  Building2,
  CalendarCheck,
  Factory,
  FileText,
  Handshake,
  History,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  LogOut,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import type { IzinHaritasi, Modul } from "@/lib/yetki";

// modul: null → herkese görünür; değer → o modülde en az okuma izni ister
const firmaMenusu: { href: string; etiket: string; Ikon: typeof Users; modul: Modul | null }[] = [
  { href: "/", etiket: "Panel", Ikon: LayoutDashboard, modul: null },
  { href: "/calisanlar", etiket: "Çalışanlar", Ikon: Users, modul: "calisanlar" },
  { href: "/makineler", etiket: "Makineler", Ikon: Factory, modul: "makineler" },
  { href: "/devam", etiket: "Devam / Puantaj", Ikon: CalendarCheck, modul: "devam" },
  { href: "/gorevler", etiket: "Görevler", Ikon: ListTodo, modul: "gorevler" },
  { href: "/musteriler", etiket: "Müşteriler & Satış", Ikon: Handshake, modul: "musteriler" },
  { href: "/teklifler", etiket: "Fiyat Teklifleri", Ikon: FileText, modul: "musteriler" },
  { href: "/tahsilatlar", etiket: "Tahsilatlar", Ikon: Banknote, modul: "tahsilatlar" },
  { href: "/firma", etiket: "Firma Bilgileri", Ikon: Building2, modul: "firma" },
];

export default function Sidebar({
  kullaniciAdi,
  rol,
  izinler,
}: {
  kullaniciAdi?: string | null;
  rol: string;
  izinler: IzinHaritasi;
}) {
  const yol = usePathname();

  async function cikisYap() {
    await signOut({ redirect: false });
    window.location.href = "/giris";
  }

  const menu =
    rol === "superadmin"
      ? [{ href: "/yonetim", etiket: "Firmalar", Ikon: ShieldCheck, modul: null }]
      : firmaMenusu.filter(({ modul }) => modul === null || izinler[modul] !== "yok");

  if (rol === "admin") {
    menu.push({ href: "/kullanicilar", etiket: "Kullanıcılar", Ikon: UserCog, modul: null });
  }
  // İşlem (denetim) kayıtlarını yalnızca adminler görür
  if (rol === "admin" || rol === "superadmin") {
    menu.push({ href: "/kayitlar", etiket: "İşlem Kayıtları", Ikon: History, modul: null });
  }

  const rolEtiketi =
    rol === "superadmin" ? "Süper Admin" : rol === "admin" ? "Firma Admini" : "Kullanıcı";

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-slate-900 text-slate-200">
      <div className="border-b border-slate-800 px-5 py-5">
        <p className="text-lg font-semibold text-white">Firma Yönetim</p>
        <p className="text-xs text-slate-400">Üretim işletme paneli</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {menu.map(({ href, etiket, Ikon }) => {
          const aktif = href === "/" ? yol === "/" : yol.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                aktif
                  ? "bg-sky-600 font-medium text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Ikon size={18} />
              {etiket}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        {kullaniciAdi && (
          <p className="truncate px-3 pb-0.5 text-xs text-slate-400">{kullaniciAdi}</p>
        )}
        <p className="px-3 pb-2 text-[11px] text-slate-500">{rolEtiketi}</p>
        <Link
          href="/sifre"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <KeyRound size={18} />
          Şifre Değiştir
        </Link>
        <button
          onClick={cikisYap}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut size={18} />
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
