import { NextResponse, type NextRequest } from "next/server";

/**
 * Phase 1 has no user accounts. This is the only access boundary:
 *  - If VOCAFORGE_ACCESS_TOKEN is set, every request needs HTTP Basic auth with it as the password.
 *  - In production, with no token, the app refuses to serve unless VOCAFORGE_ALLOW_UNAUTHENTICATED=true.
 * /api/health stays reachable for orchestrators and reveals only coarse status.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/health") return NextResponse.next();

  const token = process.env.VOCAFORGE_ACCESS_TOKEN?.trim();
  if (token) {
    const header = req.headers.get("authorization") ?? "";
    if (header.startsWith("Basic ")) {
      try {
        const decoded = atob(header.slice(6));
        const password = decoded.slice(decoded.indexOf(":") + 1);
        if (safeEqual(password, token)) return NextResponse.next();
      } catch {
        /* fall through to 401 */
      }
    }
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="VocaForge", charset="UTF-8"' },
    });
  }

  if (process.env.NODE_ENV === "production" && process.env.VOCAFORGE_ALLOW_UNAUTHENTICATED !== "true") {
    return new NextResponse(
      "VocaForge has no user accounts yet. Set VOCAFORGE_ACCESS_TOKEN, or set VOCAFORGE_ALLOW_UNAUTHENTICATED=true for a private network.",
      { status: 503 },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
