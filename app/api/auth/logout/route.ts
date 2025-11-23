import { NextRequest, NextResponse } from "next/server";
import { getAuthCookieName } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  
  // Clear authentication cookie
  response.cookies.delete(getAuthCookieName());

  return response;
}
