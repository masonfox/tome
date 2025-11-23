import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { middlewareAuthCheck } from "@/lib/auth";
import { withRequestContext, getLogger } from "@/lib/logger";
 
export function middleware(request: NextRequest) {
  return withRequestContext(() => {
    const authResult = middlewareAuthCheck(request);
    const logger = getLogger();
    if (authResult) {
      logger.debug({ path: request.nextUrl.pathname }, "Auth middleware intercepted request");
      return authResult;
    }
    logger.debug({ path: request.nextUrl.pathname }, "Auth middleware passed request");
    return NextResponse.next();
  }, request.headers.get('x-request-id') || undefined);
}
 
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

