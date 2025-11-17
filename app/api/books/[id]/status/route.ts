import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import ReadingStatus from "@/models/ReadingStatus";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const status = await ReadingStatus.findOne({ bookId: params.id });

    if (!status) {
      return NextResponse.json({ status: null });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const body = await request.json();
    const { status, rating, review, startedDate, completedDate } = body;

    if (!status || !["to-read", "read-next", "reading", "read"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'to-read', 'read-next', 'reading', or 'read'" },
        { status: 400 }
      );
    }

    // Find existing status or create new one
    let readingStatus = await ReadingStatus.findOne({ bookId: params.id });

    const updateData: any = {
      status,
    };

    // Set dates based on status
    if (status === "reading" && !readingStatus?.startedDate) {
      updateData.startedDate = startedDate || new Date();
    }

    if (status === "read") {
      if (!updateData.startedDate && !readingStatus?.startedDate) {
        updateData.startedDate = startedDate || new Date();
      }
      updateData.completedDate = completedDate || new Date();
    }

    if (rating !== undefined) {
      updateData.rating = rating;
    }

    if (review !== undefined) {
      updateData.review = review;
    }

    if (readingStatus) {
      // Update existing status
      readingStatus = await ReadingStatus.findByIdAndUpdate(
        readingStatus._id,
        updateData,
        { new: true }
      );
    } else {
      // Create new status
      readingStatus = await ReadingStatus.create({
        bookId: params.id,
        ...updateData,
      });
    }

    return NextResponse.json(readingStatus);
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
