import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo";

/**
 * GET /api/demo/status
 * 
 * Returns the current demo mode status.
 * This endpoint reads from runtime environment variables,
 * allowing demo mode to be toggled without rebuilding.
 */
export async function GET() {
  return NextResponse.json({
    isDemoMode: isDemoMode(),
    message: "This is a read-only demo. Changes are not saved.",
  });
}
