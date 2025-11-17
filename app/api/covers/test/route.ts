import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Covers API is working",
    calibreLibraryPath: process.env.CALIBRE_LIBRARY_PATH,
  });
}
