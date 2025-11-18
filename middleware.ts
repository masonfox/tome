import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
const AUTH_ENABLED = !!AUTH_PASSWORD && AUTH_PASSWORD.trim() !== "";
const AUTH_COOKIE_NAME = "tome-auth";

export function middleware(request: NextRequest) {
  // If auth is disabled, redirect /login to home
  if (!AUTH_ENABLED) {
    if (request.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Allow login page and all API routes
  if (
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // Check authentication cookie
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

  if (!authCookie || authCookie.value !== "authenticated") {
    // Redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
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
