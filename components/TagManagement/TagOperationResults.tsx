"use client";

import { useState } from "react";
import type { TagOperationResult } from "@/types/tag-operations";
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, XCircle, Copy } from "lucide-react";

interface TagOperationResultsProps {
  operation: 'merge' | 'rename' | 'delete' | 'bulk-delete';
  result: TagOperationResult;
  operationDetails?: {
    sourceTags?: string[];
    targetTag?: string;
    oldName?: string;
    newName?: string;
    deletedTag?: string;
    deletedTags?: string[];
  };
}

export function TagOperationResults({ operation, result, operationDetails }: TagOperationResultsProps) {
  const [failuresExpanded, setFailuresExpanded] = useState(false);

  const hasFailures = result.failureCount > 0;
  const hasCalibreFailures = result.calibreFailures && result.calibreFailures.length > 0;
  const hasTomeFailures = result.tomeFailures && result.tomeFailures.length > 0;

  // Get status icon and color
  const getStatusIcon = () => {
    if (!hasFailures) {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    } else if (result.successCount > 0) {
      return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
    } else {
      return <XCircle className="w-6 h-6 text-red-500" />;
    }
  };

  // Get status message
  const getStatusMessage = () => {
    const opName = {
      'merge': 'Merged',
      'rename': 'Renamed',
      'delete': 'Deleted',
      'bulk-delete': 'Deleted'
    }[operation];

    if (!hasFailures) {
      return `Successfully ${opName.toLowerCase()} ${result.successCount} of ${result.totalBooks} books`;
    } else if (result.successCount > 0) {
      return `${opName} ${result.successCount} of ${result.totalBooks} books`;
    } else {
      return `Failed to ${operation} tags`;
    }
  };

  // Get operation context message
  const getOperationContext = () => {
    switch (operation) {
      case 'merge':
        return `into "${operationDetails?.targetTag}"`;
      case 'rename':
        return `from "${operationDetails?.oldName}" to "${operationDetails?.newName}"`;
      case 'delete':
        return `"${operationDetails?.deletedTag}"`;
      case 'bulk-delete':
        return `${operationDetails?.deletedTags?.length || 0} tags`;
      default:
        return '';
    }
  };

  // Copy error report to clipboard
  const copyErrorReport = () => {
    const report = generateErrorReport();
    navigator.clipboard.writeText(report);
    // Could add a toast notification here
  };

  // Generate formatted error report
  const generateErrorReport = () => {
    let report = `Tag Operation Error Report\n`;
    report += `================================\n\n`;
    report += `Operation: ${operation}\n`;
    report += `Total Books: ${result.totalBooks}\n`;
    report += `Successful: ${result.successCount}\n`;
    report += `Failed: ${result.failureCount}\n\n`;

    if (operationDetails) {
      report += `Details:\n`;
      if (operationDetails.sourceTags) report += `  Source Tags: ${operationDetails.sourceTags.join(', ')}\n`;
      if (operationDetails.targetTag) report += `  Target Tag: ${operationDetails.targetTag}\n`;
      if (operationDetails.oldName) report += `  Old Name: ${operationDetails.oldName}\n`;
      if (operationDetails.newName) report += `  New Name: ${operationDetails.newName}\n`;
      if (operationDetails.deletedTag) report += `  Deleted Tag: ${operationDetails.deletedTag}\n`;
      if (operationDetails.deletedTags) report += `  Deleted Tags: ${operationDetails.deletedTags.join(', ')}\n`;
      report += `\n`;
    }

    if (hasCalibreFailures && result.calibreFailures) {
      report += `Calibre Failures (${result.calibreFailures.length}):\n`;
      report += `--------------------------------\n`;
      result.calibreFailures.forEach((failure, idx) => {
        report += `${idx + 1}. ${failure.title || `Book ID ${failure.bookId || failure.calibreId}`}\n`;
        report += `   Calibre ID: ${failure.calibreId}\n`;
        if (failure.bookId) report += `   Book ID: ${failure.bookId}\n`;
        report += `   Error: ${failure.error}\n\n`;
      });
    }

    if (hasTomeFailures && result.tomeFailures) {
      report += `Tome Database Failures (${result.tomeFailures.length}):\n`;
      report += `--------------------------------\n`;
      result.tomeFailures.forEach((failure, idx) => {
        report += `${idx + 1}. Book ID: ${failure.bookId}\n`;
        report += `   Error: ${failure.error}\n\n`;
      });
    }

    return report;
  };

  return (
    <div className="space-y-4">
      {/* Status Summary */}
      <div className="flex items-start gap-3">
        {getStatusIcon()}
        <div className="flex-1">
          <p className="text-base font-medium text-[var(--foreground)]">
            {getStatusMessage()}
          </p>
          {operationDetails && (
            <p className="text-sm text-[var(--subheading-text)] mt-1">
              {getOperationContext()}
            </p>
          )}
        </div>
      </div>

      {/* Failure Details */}
      {hasFailures && (
        <div className="space-y-3">
          <button
            onClick={() => setFailuresExpanded(!failuresExpanded)}
            className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
          >
            {failuresExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Failed Books ({result.failureCount})
          </button>

          {failuresExpanded && (
            <div className="space-y-3 pl-6">
              {/* Calibre Failures */}
              {hasCalibreFailures && result.calibreFailures && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--subheading-text)] uppercase">
                    Calibre Sync Failures
                  </p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {result.calibreFailures.map((failure, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-sm"
                      >
                        <p className="font-medium text-[var(--foreground)]">
                          {failure.title || `Book ${failure.bookId || failure.calibreId}`}
                        </p>
                        <p className="text-xs text-[var(--subheading-text)] mt-1">
                          Calibre ID: {failure.calibreId}
                          {failure.bookId && ` • Book ID: ${failure.bookId}`}
                        </p>
                        <p className="text-xs text-red-400 mt-2">
                          {failure.error}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tome Failures */}
              {hasTomeFailures && result.tomeFailures && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--subheading-text)] uppercase">
                    Database Update Failures
                  </p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {result.tomeFailures.map((failure, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-sm"
                      >
                        <p className="font-medium text-[var(--foreground)]">
                          Book ID: {failure.bookId}
                        </p>
                        <p className="text-xs text-red-400 mt-2">
                          {failure.error}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy Error Report Button */}
              <button
                onClick={copyErrorReport}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--foreground)]/10 rounded-md transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Error Report
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      {hasFailures && result.successCount > 0 && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-[var(--foreground)]/70">
            <span className="font-medium">Note:</span> {result.successCount} books were successfully updated. 
            The failed books were not modified and retain their original tags.
          </p>
        </div>
      )}
    </div>
  );
}
