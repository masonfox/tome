import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { proxyAuthCheck } from "@/lib/auth";

const DEMO_MODE = process.env.DEMO_MODE === "true";

// HTTP methods that modify data
const MUTATION_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

// API routes allowed even in demo mode
const DEMO_ALLOWED_ROUTES = ["/api/auth/login", "/api/auth/logout", "/api/auth/status", "/api/demo/status"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets - anything with a file extension except .json
  if (pathname.match(/\.\w+$/) && !pathname.endsWith('.json')) {
    return NextResponse.next();
  }

  // Skip Next.js internals
  if (pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // Demo mode: block mutation requests on API routes
  if (DEMO_MODE && MUTATION_METHODS.includes(request.method) && pathname.startsWith("/api/")) {
    // Allow whitelisted routes
    if (DEMO_ALLOWED_ROUTES.some((route) => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Block all other mutations with a friendly error
    return NextResponse.json(
      {
        error: "This is a read-only demo. Changes are not saved.",
        demo: true,
      },
      { status: 403 }
    );
  }

  const authResult = proxyAuthCheck(request);
  if (authResult) {
    return authResult;
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*', // Match everything, exclusions handled above
};
