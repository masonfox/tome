import { NextResponse } from "next/server";
import { isAuthEnabled, isAuthenticated } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    enabled: isAuthEnabled(),
    authenticated: await isAuthenticated(),
  });
}
