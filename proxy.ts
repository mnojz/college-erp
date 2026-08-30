import { NextResponse, type NextRequest } from "next/server";
import jwt, { type JwtPayload } from "jsonwebtoken";

export const config = {
  matcher: [
    // Run on all page routes but skip API routes (their handlers do their own
    // per-resource authorization) and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

// Public page prefixes — no auth required.
const PUBLIC_PREFIXES = ["/public", "/login"];

// Role → route-prefix map for protected role homes.
const ROLE_ROUTE: Record<string, string> = {
  ADMIN: "/admin",
  TEACHER: "/teacher",
  STUDENT: "/student",
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured for proxy");
  }
  return secret;
}

/**
 * Read and verify the session cookie. Runs in the Node.js runtime (Next 16
 * proxy defaults to Node), so `jsonwebtoken` is available.
 */
function getSession(
  request: NextRequest,
): { userId: string; role: string } | null {
  const token = request.cookies.get("college_erp_session")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    if (
      typeof payload === "object" &&
      payload !== null &&
      typeof payload.userId === "string" &&
      typeof payload.role === "string"
    ) {
      return { userId: payload.userId, role: payload.role };
    }
  } catch {
    // Invalid/expired token → treated as unauthenticated.
  }
  return null;
}

/**
 * Server-side auth proxy (Next 16's replacement for middleware).
 *
 * - `/`                    → logged-in users are sent to /dashboard; others see the homepage.
 * - public pages           → pass through.
 * - protected pages        → unauthenticated users go to /login.
 * - `/dashboard`           → the single dashboard endpoint for every role; the page
 *                            renders role-specific content based on the session.
 * - legacy role paths      → `/student`, `/teacher`, `/admin` (exact) redirect to `/dashboard`.
 * - role sub-pages         → e.g. `/student/results` stay role-gated: a user can only reach
 *                            their own role's pages; anything else bounces to /dashboard.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public pages pass through untouched.
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const session = getSession(request);

  // Root path: logged-in → their dashboard, logged-out → public homepage.
  if (pathname === "/") {
    return session
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next();
  }

  // Any other protected page while unauthenticated → login.
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Shared dashboard is open to every authenticated user.
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return NextResponse.next();
  }

  // Legacy exact role-home paths — everyone now lives at /dashboard.
  if (Object.values(ROLE_ROUTE).includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Role sub-pages (e.g. /student/results, /teacher/materials, /admin/people):
  // a user may only access pages under their own role's prefix.
  const roleHome = ROLE_ROUTE[session.role];
  if (Object.values(ROLE_ROUTE).some((home) => pathname.startsWith(`${home}/`))) {
    if (roleHome && pathname.startsWith(`${roleHome}/`)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}