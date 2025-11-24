import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { middlewareAuthCheck } from "@/lib/auth";
import { withRequestContext, getLogger } from "@/lib/logger";
 
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip static assets - anything with a file extension except .json
  if (pathname.match(/\.\w+$/) && !pathname.endsWith('.json')) {
    return NextResponse.next();
  }
  
  // Skip Next.js internals
  if (pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

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
  matcher: '/:path*', // Match everything, exclusions handled above
};

