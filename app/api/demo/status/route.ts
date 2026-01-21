import { NextResponse } from "next/server";
import { getDemoConfig } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getDemoConfig());
}
