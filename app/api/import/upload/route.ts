/**
 * Import Upload API Route
 * POST /api/import/upload
 * 
 * Handles CSV file upload, validation, and initial parsing
 */

import { NextRequest, NextResponse } from "next/server";
import { csvParserService } from "@/lib/services/csv-parser.service";
import { ProviderSchema } from "@/lib/schemas/csv-provider.schema";
import { importLogRepository } from "@/lib/repositories/import-log.repository";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const importId = crypto.randomUUID();
  
  try {
    // Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const providerParam = formData.get("provider") as string | null;

    // Validate provider parameter
    if (!providerParam) {
      return NextResponse.json(
        {
          success: false,
          error: "Provider is required",
          details: "Please specify whether the CSV is from Goodreads or TheStoryGraph",
          code: "PROVIDER_REQUIRED",
        },
        { status: 400 }
      );
    }

    const providerValidation = ProviderSchema.safeParse(providerParam);
    if (!providerValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid provider",
          details: "Provider must be either 'goodreads' or 'storygraph'",
          code: "INVALID_PROVIDER",
        },
        { status: 400 }
      );
    }

    const provider = providerValidation.data;

    // Validate file
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "File is required",
          details: "Please upload a CSV file",
          code: "FILE_REQUIRED",
        },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.type.includes("csv") && !file.name.endsWith(".csv")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type",
          details: "Only CSV files are supported",
          code: "INVALID_FILE_TYPE",
        },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "File too large",
          details: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024} MB`,
          code: "FILE_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    // Check if file is empty
    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Empty file",
          details: "The uploaded file is empty",
          code: "EMPTY_FILE",
        },
        { status: 400 }
      );
    }

    logger.info(
      {
        importId,
        fileName: file.name,
        fileSize: file.size,
        provider,
      },
      "Import upload started"
    );

    // Read file content
    const csvContent = await file.text();

    // Parse CSV
    const parseResult = await csvParserService.parseCSV(csvContent, provider);

    // Check for parsing errors
    if (parseResult.errors.length > 0) {
      // Fatal error (e.g., missing columns, invalid format)
      const fatalError = parseResult.errors.find((e) => e.rowNumber === 0);
      
      if (fatalError) {
        logger.error(
          {
            importId,
            error: fatalError.message,
            provider,
          },
          "CSV parsing failed"
        );

        return NextResponse.json(
          {
            success: false,
            error: "Invalid CSV format",
            details: fatalError.message,
            code: "INVALID_CSV_FORMAT",
          },
          { status: 400 }
        );
      }
    }

    // Check if any records were parsed
    if (parseResult.validRows === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Empty CSV file",
          details: "CSV must contain at least one valid record",
          code: "EMPTY_CSV",
        },
        { status: 400 }
      );
    }

    // Create import log record (status: pending)
    const importLog = await importLogRepository.create({
      fileName: file.name,
      fileSize: file.size,
      provider,
      totalRecords: parseResult.totalRows,
      matchedRecords: 0, // Will be updated after matching
      unmatchedRecords: 0,
      sessionsCreated: 0,
      sessionsSkipped: 0,
      ratingsSync: 0,
      calibreSyncFailures: 0,
      startedAt: new Date(),
      status: "pending",
      userId: null, // Single-user mode
    });

    logger.info(
      {
        importId: importLog.id,
        totalRecords: parseResult.totalRows,
        validRows: parseResult.validRows,
        skippedRows: parseResult.skippedRows,
      },
      "CSV parsed successfully"
    );

    // TODO: Phase 4 - Perform book matching here
    // For now, just return the parse result without matching

    // Return upload response
    return NextResponse.json(
      {
        success: true,
        importId: importLog.id.toString(),
        provider,
        totalRecords: parseResult.totalRows,
        fileName: file.name,
        fileSize: file.size,
        preview: {
          exactMatches: 0, // TODO: Phase 4 - calculate from matching
          highConfidenceMatches: 0,
          lowConfidenceMatches: 0,
          unmatchedRecords: parseResult.validRows,
        },
        validRows: parseResult.validRows,
        skippedRows: parseResult.skippedRows,
        parseErrors: parseResult.errors.filter((e) => e.rowNumber > 0),
        createdAt: importLog.createdAt,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(
      {
        err: error,
        importId,
      },
      "Import upload failed"
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message || "Failed to process upload",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
