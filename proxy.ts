import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { proxyAuthCheck } from "@/lib/auth";

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

  const authResult = proxyAuthCheck(request);
  if (authResult) {
    return authResult;
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*', // Match everything, exclusions handled above
};
