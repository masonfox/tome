import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "tome-auth";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

export function isAuthEnabled(): boolean {
  return !!AUTH_PASSWORD && AUTH_PASSWORD.trim() !== "";
}

export function getAuthPassword(): string {
  return AUTH_PASSWORD || "";
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export async function isAuthenticated(): Promise<boolean> {
  if (!isAuthEnabled()) {
    return true; // Auth disabled, always authenticated
  }

  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME);
  
  return authCookie?.value === "authenticated";
}

export function isAuthenticatedFromRequest(request: NextRequest): boolean {
  if (!isAuthEnabled()) {
    return true; // Auth disabled, always authenticated
  }

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

  return authCookie?.value === "authenticated";
}

function isSecureConnection(request: NextRequest): boolean {
  // Check x-forwarded-proto header (for reverse proxies/load balancers)
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto === 'https';
  }

  // Fall back to checking the URL protocol
  return request.url.startsWith('https://');
}

export function createAuthResponse(request: NextRequest): NextResponse {
  const response = NextResponse.json({ success: true });
  
  // Set authentication cookie
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "authenticated",
    httpOnly: true,
    secure: isSecureConnection(request),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}

export function middlewareAuthCheck(request: NextRequest): NextResponse | null {
  // If auth is disabled, redirect /login to home
  if (!isAuthEnabled()) {
    if (request.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return null; // Continue to next middleware
  }

  // Allow login page and all API routes
  if (
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/api/")
  ) {
    return null; // Continue to next middleware
  }

  // Check authentication cookie
  if (!isAuthenticatedFromRequest(request)) {
    // Redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return null; // Continue to next middleware
}
