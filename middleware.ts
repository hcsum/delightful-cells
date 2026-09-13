import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  hasLocalePrefix,
  localeFromPathname,
  stripLocalePrefix,
} from "@/lib/locale-routing";
import { PRIMARY_HOST } from "@/lib/site";

const REDIRECT_HOSTS = new Set([
  "www.delightfulcells.com",
  "extractfromexcel.com",
  "www.extractfromexcel.com",
]);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  if (host && REDIRECT_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = PRIMARY_HOST;
    return NextResponse.redirect(url, 308);
  }

  const { pathname } = request.nextUrl;
  const locale = localeFromPathname(pathname);

  if (hasLocalePrefix(pathname) && locale === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = stripLocalePrefix(pathname);
    return NextResponse.redirect(url, 308);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale);

  if (hasLocalePrefix(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = stripLocalePrefix(pathname);
    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
