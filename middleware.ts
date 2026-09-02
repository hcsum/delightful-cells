import { NextRequest, NextResponse } from "next/server";

const PRIMARY_HOST = "delightfulcells.com";
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

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
