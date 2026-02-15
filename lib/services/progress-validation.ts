import { ProgressLog } from "@/lib/db/schema/progress-logs";
import { progressRepository } from "@/lib/repositories";
import { formatDateToString } from "@/lib/utils/date-validation";
import { formatDate } from "@/utils/dateHelpers";

export interface ProgressValidationResult {
  valid: boolean;
  error?: string;
  conflictingEntry?: {
    id: number;
    date: string;
    progress: number;
    type: 'before' | 'after';
  };
}

/**
 * Validates that a new progress entry maintains temporal consistency
 * 
 * Rules:
 * 1. Progress must be ≥ all entries BEFORE the new date
 * 2. Progress must be ≤ all entries AFTER the new date
 * 3. This ensures monotonic progress over time
 * 
 * @param sessionId Session ID
 * @param progressDateString Date string in YYYY-MM-DD format (ADR-014)
 * @param newProgress currentPage or currentPercentage value
 * @param usePercentage Whether newProgress is a percentage (true) or page number (false)
 */
export async function validateProgressTimeline(
  sessionId: number,
  progressDateString: string, // ADR-014: Accept date string, not Date object
  newProgress: number, // currentPage or currentPercentage
  usePercentage: boolean = true
): Promise<ProgressValidationResult> {
  
  // Find entries before and after the new date
  const entriesBefore = await progressRepository.findBeforeDateForSession(sessionId, progressDateString);
  const entriesAfter = await progressRepository.findAfterDateForSession(sessionId, progressDateString);
  
  // Validate against entries BEFORE (must be ≥ previous progress)
  const maxBefore = entriesBefore.reduce((max, entry) => {
    const value = usePercentage ? entry.currentPercentage : entry.currentPage;
    return Math.max(max, value);
  }, 0);
  
  if (entriesBefore.length > 0 && newProgress < maxBefore) {
    const conflicting = entriesBefore.find(e => 
      (usePercentage ? e.currentPercentage : e.currentPage) === maxBefore
    );
    
    const unit = usePercentage ? '%' : 'page ';
    const formattedProgress = usePercentage ? maxBefore.toFixed(1) : Math.floor(maxBefore);
    
    return {
      valid: false,
      error: `Progress must be at least ${usePercentage ? '' : unit}${formattedProgress}${usePercentage ? unit : ''} ` +
             `(your progress on ${formatDate(conflicting!.progressDate)})`,
      conflictingEntry: conflicting ? {
        id: conflicting.id,
        date: formatDate(conflicting.progressDate),
        progress: maxBefore,
        type: 'before'
      } : undefined
    };
  }
  
  // Validate against entries AFTER (must be ≤ future progress)
  const minAfter = entriesAfter.reduce((min, entry) => {
    const value = usePercentage ? entry.currentPercentage : entry.currentPage;
    return Math.min(min, value);
  }, Infinity);
  
  if (entriesAfter.length > 0 && newProgress > minAfter) {
    const conflicting = entriesAfter.find(e => 
      (usePercentage ? e.currentPercentage : e.currentPage) === minAfter
    );
    
    const unit = usePercentage ? '%' : 'page ';
    const formattedProgress = usePercentage ? minAfter.toFixed(1) : Math.floor(minAfter);
    
    return {
      valid: false,
      error: `Progress cannot exceed ${usePercentage ? '' : unit}${formattedProgress}${usePercentage ? unit : ''} ` +
             `(your progress on ${formatDate(conflicting!.progressDate)})`,
      conflictingEntry: conflicting ? {
        id: conflicting.id,
        date: formatDate(conflicting.progressDate),
        progress: minAfter,
        type: 'after'
      } : undefined
    };
  }
  
  return { valid: true };
}

/**
 * Validates progress entry for editing
 * Similar to validateProgressTimeline but excludes the entry being edited
 * 
 * @param entryId ID of the entry being edited
 * @param sessionId Session ID
 * @param progressDateString Date string in YYYY-MM-DD format (ADR-014)
 * @param newProgress currentPage or currentPercentage value
 * @param usePercentage Whether newProgress is a percentage (true) or page number (false)
 */
export async function validateProgressEdit(
  entryId: number,
  sessionId: number,
  progressDateString: string, // ADR-014: Accept date string, not Date object
  newProgress: number,
  usePercentage: boolean = true
): Promise<ProgressValidationResult> {
  // Get all entries except the one being edited
  const allEntries = await progressRepository.findBySessionId(sessionId);
  const otherEntries = allEntries.filter(e => e.id !== entryId);
  
  // ADR-014: Use lexicographic string comparison for dates
  const entriesBefore = otherEntries.filter(e => 
    e.progressDate < progressDateString
  );
  const entriesAfter = otherEntries.filter(e => 
    e.progressDate > progressDateString
  );
  
  // Validate against entries BEFORE (must be ≥ previous progress)
  const maxBefore = entriesBefore.reduce((max, entry) => {
    const value = usePercentage ? entry.currentPercentage : entry.currentPage;
    return Math.max(max, value);
  }, 0);
  
  if (entriesBefore.length > 0 && newProgress < maxBefore) {
    const conflicting = entriesBefore.find(e => 
      (usePercentage ? e.currentPercentage : e.currentPage) === maxBefore
    );
    
    const unit = usePercentage ? '%' : 'page ';
    const formattedProgress = usePercentage ? maxBefore.toFixed(1) : Math.floor(maxBefore);
    
    return {
      valid: false,
      error: `Progress must be at least ${usePercentage ? '' : unit}${formattedProgress}${usePercentage ? unit : ''} ` +
             `(your progress on ${formatDate(conflicting!.progressDate)})`,
      conflictingEntry: conflicting ? {
        id: conflicting.id,
        date: formatDate(conflicting.progressDate),
        progress: maxBefore,
        type: 'before'
      } : undefined
    };
  }
  
  // Validate against entries AFTER (must be ≤ future progress)
  const minAfter = entriesAfter.reduce((min, entry) => {
    const value = usePercentage ? entry.currentPercentage : entry.currentPage;
    return Math.min(min, value);
  }, Infinity);
  
  if (entriesAfter.length > 0 && newProgress > minAfter) {
    const conflicting = entriesAfter.find(e => 
      (usePercentage ? e.currentPercentage : e.currentPage) === minAfter
    );
    
    const unit = usePercentage ? '%' : 'page ';
    const formattedProgress = usePercentage ? minAfter.toFixed(1) : Math.floor(minAfter);
    
    return {
      valid: false,
      error: `Progress cannot exceed ${usePercentage ? '' : unit}${formattedProgress}${usePercentage ? unit : ''} ` +
             `(your progress on ${formatDate(conflicting!.progressDate)})`,
      conflictingEntry: conflicting ? {
        id: conflicting.id,
        date: formatDate(conflicting.progressDate),
        progress: minAfter,
        type: 'after'
      } : undefined
    };
  }
  
  return { valid: true };
}
