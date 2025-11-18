import { NextRequest, NextResponse } from "next/server";
import { getAuthPassword, getAuthCookieName, isAuthEnabled } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Authentication not enabled" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    if (password === getAuthPassword()) {
      const response = NextResponse.json({ success: true });
      
      // Set authentication cookie
      response.cookies.set({
        name: getAuthCookieName(),
        value: "authenticated",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      return response;
    } else {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
