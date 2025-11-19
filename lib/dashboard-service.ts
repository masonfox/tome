import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";
import Streak from "@/models/Streak";

export interface DashboardStats {
  booksRead: {
    thisYear: number;
    total: number;
  };
  currentlyReading: number;
  pagesRead: {
    today: number;
    thisMonth: number;
  };
  avgPagesPerDay: number;
}

export interface DashboardStreak {
  currentStreak: number;
  longestStreak: number;
}

export interface BookWithStatus {
  _id: any;
  title: string;
  authors: string[];
  calibreId: number;
  status?: string | null;
  latestProgress?: any;
}

export interface DashboardData {
  stats: DashboardStats | null;
  streak: DashboardStreak | null;
  currentlyReading: BookWithStatus[];
  currentlyReadingTotal: number;
  readNext: BookWithStatus[];
  readNextTotal: number;
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    await connectDB();

    // Get stats
    const stats = await getStats();
    
    // Get streak
    const streak = await getStreak();
    
    // Get currently reading books with total count
    const { books: currentlyReading, total: currentlyReadingTotal } = await getBooksByStatus("reading", 6);
    
    // Get read next books with total count
    const { books: readNext, total: readNextTotal } = await getBooksByStatus("read-next", 6);

    return {
      stats,
      streak,
      currentlyReading,
      currentlyReadingTotal,
      readNext,
      readNextTotal,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return {
      stats: null,
      streak: null,
      currentlyReading: [],
      currentlyReadingTotal: 0,
      readNext: [],
      readNextTotal: 0,
    };
  }
}

async function getStats(): Promise<DashboardStats | null> {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Books read this year
    const booksReadThisYear = await ReadingSession.countDocuments({
      status: "completed",
      endDate: { $gte: startOfYear }
    });

    // Total books read
    const totalBooksRead = await ReadingSession.countDocuments({
      status: "completed"
    });

    // Currently reading count
    const currentlyReadingCount = await ReadingSession.countDocuments({
      status: "reading",
      isActive: true
    });

    // Pages read today
    const pagesToday = await ProgressLog.aggregate([
      {
        $match: {
          progressDate: {
            $gte: new Date(today.setHours(0, 0, 0, 0))
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$pagesRead" }
        }
      }
    ]);

    // Pages read this month
    const pagesThisMonth = await ProgressLog.aggregate([
      {
        $match: {
          progressDate: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$pagesRead" }
        }
      }
    ]);

    // Average pages per day (last 30 days)
    const avgPagesData = await ProgressLog.aggregate([
      {
        $match: {
          progressDate: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$progressDate" } },
          dailyPages: { $sum: "$pagesRead" }
        }
      },
      {
        $group: {
          _id: null,
          avgPages: { $avg: "$dailyPages" }
        }
      }
    ]);

    return {
      booksRead: {
        thisYear: booksReadThisYear,
        total: totalBooksRead,
      },
      currentlyReading: currentlyReadingCount,
      pagesRead: {
        today: pagesToday[0]?.total || 0,
        thisMonth: pagesThisMonth[0]?.total || 0,
      },
      avgPagesPerDay: Math.round(avgPagesData[0]?.avgPages || 0),
    };
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return null;
  }
}

async function getStreak(): Promise<DashboardStreak | null> {
  try {
    const streak = await Streak.findOne();
    
    if (!streak) {
      return {
        currentStreak: 0,
        longestStreak: 0,
      };
    }

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
    };
  } catch (error) {
    console.error("Failed to fetch streak:", error);
    return null;
  }
}

async function getBooksByStatus(status: string, limit: number): Promise<{ books: BookWithStatus[], total: number }> {
  try {
    // Get total count for this status
    const total = await ReadingSession.countDocuments({
      status,
      isActive: true,
    });

    // Get limited session records sorted by most recently updated
    const sessionRecords = await ReadingSession.find({
      status,
      isActive: true,
    }).select("bookId _id updatedAt").sort({ updatedAt: -1 }).limit(limit);

    const bookIds = sessionRecords.map((s) => s.bookId);

    if (bookIds.length === 0) {
      return { books: [], total };
    }

    const books = await Book.find({
      _id: { $in: bookIds },
      orphaned: { $ne: true },
    }).limit(limit);

    // Create a map of books by ID for easy lookup
    const bookMap = new Map<string, any>();
    books.forEach(book => {
      bookMap.set((book._id as any).toString(), book);
    });

    // Build results in the order of sessionRecords (sorted by updatedAt)
    const booksWithStatus = [];
    for (const session of sessionRecords) {
      const book = bookMap.get(session.bookId.toString());
      if (!book) continue; // Skip if book was filtered out (orphaned)

      // Use the session we already have from sessionRecords (maintains sort order)
      let latestProgress = null;
      latestProgress = await ProgressLog.findOne({
        bookId: book._id,
        sessionId: session._id,
      }).sort({ progressDate: -1 });

      booksWithStatus.push({
        ...JSON.parse(JSON.stringify(book)),
        status: status,
        latestProgress: latestProgress ? JSON.parse(JSON.stringify(latestProgress)) : null,
      });
    }

    return { books: booksWithStatus, total };
  } catch (error) {
    console.error(`Failed to fetch books with status ${status}:`, error);
    return { books: [], total: 0 };
  }
}