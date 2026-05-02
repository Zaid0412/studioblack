import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Middleware for route protection.
 *
 * Uses `getSessionCookie()` — Edge-safe, no DB call. It only checks for the
 * presence of the `better-auth.session_token` cookie. Full session validation
 * (DB lookup, expiry check) happens in the layout Server Components via
 * `auth.api.getSession()`.
 *
 * Two-layer security model:
 * 1. Middleware → fast cookie-presence gate (prevents unnecessary rendering)
 * 2. Layouts → full session validation with role-based guards
 */
const AUTH_PAGES = new Set(["/login", "/register", "/forgot-password"]);

/** Route-protection middleware: redirects unauthenticated users to login and authenticated users away from auth pages. */
export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname, search } = request.nextUrl;

  // Authenticated user on auth pages → redirect to dashboard
  if (sessionCookie && AUTH_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // /reset-password and /verify-email are always public
  // (token-based, may be used while logged in or logged out)
  if (
    pathname === "/reset-password" ||
    pathname === "/verify-email" ||
    pathname === "/verify-email-change"
  ) {
    return NextResponse.next();
  }

  // Unauthenticated → redirect to login with returnTo (preserving query string)
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    const returnPath = pathname + search;
    if (returnPath !== "/") {
      loginUrl.searchParams.set("returnTo", returnPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Forward the pathname so server components (e.g. dashboard layout) can
  // do role-based route guards without parsing the URL themselves.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - /login (auth page — must be public)
     * - /api/auth/* (better-auth API routes)
     * - /_next/static and /_next/image (Next.js internals)
     * - Static file extensions (images, fonts, favicon, etc.)
     */
    "/((?!login|register|forgot-password|reset-password|verify-email|verify-email-change|api/auth|api/health|api/settings/verify-email-change|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
