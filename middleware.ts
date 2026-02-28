import { NextRequest, NextResponse } from "next/server";

// Protect everything except Next internals, login, and auth endpoints
const PUBLIC_PATHS = new Set([
    "/login",
    "/api/auth",
    "/api/warmup",
]);

function isPublicPath(pathname: string) {
    if (PUBLIC_PATHS.has(pathname)) return true;
    if (pathname.startsWith("/_next")) return true;
    if (pathname.startsWith("/favicon")) return true;
    if (pathname.startsWith("/robots.txt")) return true;
    if (pathname.startsWith("/sitemap")) return true;
    return false;
}

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (isPublicPath(pathname)) return NextResponse.next();

    const cookieName = process.env.MVP_AUTH_COOKIE_NAME ?? "mvp_auth";
    const expectedValue = process.env.MVP_AUTH_COOKIE_VALUE ?? "1";
    const authCookie = req.cookies.get(cookieName)?.value;

    if (authCookie === expectedValue) return NextResponse.next();

    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image).*)"],
};