/**
 * PUT /api/sessions/read-next/reorder
 * 
 * Batch reorders read-next books.
 * Request body: { updates: Array<{ id: number, readNextOrder: number }> }
 */

import { NextResponse } from "next/server";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { z } from "zod";

const reorderSchema = z.object({
  updates: z.array(
    z.object({
      id: z.number().int(),
      readNextOrder: z.number().int().min(0),
    })
  ),
});

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { updates } = reorderSchema.parse(body);

    await sessionRepository.reorderReadNextBooks(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    console.error("[API /api/sessions/read-next/reorder] Error:", error);
    return NextResponse.json(
      { error: "Failed to reorder books" },
      { status: 500 }
    );
  }
}
