import { NextResponse } from "next/server";
import { getLastSyncTime, isSyncInProgress } from "@/lib/sync-service";

export async function GET() {
  return NextResponse.json({
    lastSync: getLastSyncTime(),
    syncInProgress: isSyncInProgress(),
    autoSyncEnabled: !!process.env.CALIBRE_LIBRARY_PATH,
  });
}
