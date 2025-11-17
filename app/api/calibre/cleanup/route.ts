import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";
import ReadingStatus from "@/models/ReadingStatus";
import ProgressLog from "@/models/ProgressLog";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { action } = await request.json();

    if (action === "list") {
      // List all orphaned books
      const orphanedBooks = await Book.find({ orphaned: true }).select(
        "_id title authors calibreId orphanedAt"
      );

      return NextResponse.json({
        success: true,
        orphanedBooks,
        count: orphanedBooks.length,
      });
    }

    if (action === "permanent-delete") {
      // Delete all orphaned books and related records
      const orphanedBooks = await Book.find({ orphaned: true });
      const bookIds = orphanedBooks.map((b) => b._id);

      const [deletedBooks, deletedStatuses, deletedLogs] = await Promise.all([
        Book.deleteMany({ _id: { $in: bookIds } }),
        ReadingStatus.deleteMany({ bookId: { $in: bookIds } }),
        ProgressLog.deleteMany({ bookId: { $in: bookIds } }),
      ]);

      return NextResponse.json({
        success: true,
        deletedCount: bookIds.length,
        details: {
          books: deletedBooks.deletedCount,
          statuses: deletedStatuses.deletedCount,
          logs: deletedLogs.deletedCount,
        },
        message: `Permanently deleted ${bookIds.length} orphaned books and their records`,
      });
    }

    if (action === "restore") {
      // Restore all orphaned books (in case they were re-added)
      const result = await Book.updateMany(
        { orphaned: true },
        { $set: { orphaned: false, orphanedAt: null } }
      );

      return NextResponse.json({
        success: true,
        restoredCount: result.modifiedCount,
        message: `Restored ${result.modifiedCount} books`,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use: list, permanent-delete, or restore" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cleanup failed",
      },
      { status: 500 }
    );
  }
}
