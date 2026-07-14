import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Firma Yönetim Paneli",
  description: "Küçük üretim işletmeleri için işletme yönetim paneli",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="font-sans">{children}</body>
    </html>
  );
}
