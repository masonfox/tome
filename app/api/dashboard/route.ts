import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard-service";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Error fetching dashboard data");
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
