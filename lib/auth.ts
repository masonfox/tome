import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "tome-auth";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

export function isAuthEnabled(): boolean {
  return !!AUTH_PASSWORD && AUTH_PASSWORD.trim() !== "";
}

export function getAuthPassword(): string {
  return AUTH_PASSWORD || "";
}

export async function isAuthenticated(): Promise<boolean> {
  if (!isAuthEnabled()) {
    return true; // Auth disabled, always authenticated
  }

  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME);
  
  return authCookie?.value === "authenticated";
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}
