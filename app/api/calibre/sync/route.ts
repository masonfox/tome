import { NextResponse } from "next/server";
import { syncCalibreLibrary, getLastSyncTime, isSyncInProgress } from "@/lib/sync-service";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check if sync is already in progress
    if (isSyncInProgress()) {
      return NextResponse.json({
        success: false,
        error: "Sync already in progress",
        message: "Another sync operation is currently running",
      });
    }

    const result = await syncCalibreLibrary();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Synced ${result.syncedCount} new books and updated ${result.updatedCount} existing books`,
        totalBooks: result.totalBooks,
        syncedCount: result.syncedCount,
        updatedCount: result.updatedCount,
        lastSync: getLastSyncTime(),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to sync with Calibre database",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Calibre sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync with Calibre database",
      },
      { status: 500 }
    );
  }
}
