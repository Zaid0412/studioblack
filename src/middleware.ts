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
export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Landing page is public — skip auth checks
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Authenticated user on /login or /register → redirect to dashboard
  if (sessionCookie && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated → redirect to login
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
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
    "/((?!login|register|api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
