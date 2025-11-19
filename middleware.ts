import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { middlewareAuthCheck } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const authResult = middlewareAuthCheck(request);
  
  if (authResult) {
    return authResult;
  }
  
  return NextResponse.next();
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
