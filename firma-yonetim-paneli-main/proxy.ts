import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

// Next 16'da middleware'in yeni adı "proxy". Oturum, Auth.js'in imzalı/şifreli
// JWT çerezi doğrulanarak kontrol edilir (Prisma'ya gerek yok).
//
// Çerez adı, bağlantının HTTPS olup olmamasına göre seçilir (NODE_ENV'e göre
// DEĞİL): Auth.js düz HTTP'de (ör. yerel ağ, http://192.168.x.x:3000) güvensiz
// "authjs.session-token", HTTPS'te "__Secure-" ön ekli çerez kullanır. İkisinin
// eşleşmesi şarttır; aksi hâlde oturum okunamaz ve giriş yapılamaz.

export default async function proxy(request: NextRequest) {
  const httpsMi =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  const cerezAdi = httpsMi
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET!,
    cookieName: cerezAdi,
    salt: cerezAdi,
    secureCookie: httpsMi,
  });
  const girisli = !!token;
  const { pathname } = request.nextUrl;

  // Giriş sayfası: oturum varsa panele yönlendir, yoksa serbest
  if (pathname.startsWith("/giris")) {
    return girisli
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (!girisli) {
    // API uçları: yönlendirme yerine düz JSON 401
    // (ileride mobil istemciler de aynı davranışı bekleyecek)
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ hata: "Oturum gerekli" }, { status: 401 });
    }
    const girisUrl = new URL("/giris", request.url);
    girisUrl.searchParams.set("callbackUrl", request.nextUrl.href);
    return NextResponse.redirect(girisUrl);
  }

  // Rol bazlı sayfa ayrımı (API yetkileri sunucu tarafında ayrıca denetlenir):
  // süper admin yalnızca yönetim ekranını, firma kullanıcıları paneli görür
  if (!pathname.startsWith("/api")) {
    const superadmin = token.rol === "superadmin";
    if (superadmin && !pathname.startsWith("/yonetim") && !pathname.startsWith("/sifre")) {
      return NextResponse.redirect(new URL("/yonetim", request.url));
    }
    if (!superadmin && pathname.startsWith("/yonetim")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Auth uçları, statik dosyalar ve favicon hariç her şeyi koru
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
