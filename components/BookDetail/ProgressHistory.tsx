import { Edit2, Trash2 } from "lucide-react";
import { formatDateOnly } from "@/utils/dateFormatting";

interface ProgressEntry {
  id: number;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;
  notes?: string;
  pagesRead: number;
}

interface ProgressHistoryProps {
  progress: ProgressEntry[];
  onEdit: (entry: ProgressEntry) => void;
}

export default function ProgressHistory({ progress, onEdit }: ProgressHistoryProps) {
  return (
    <div>
      <h3 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
        Current Progress History
      </h3>

      {progress.length === 0 ? (
        <p className="text-sm text-[var(--foreground)]/60 italic">
          No progress logged yet
        </p>
      ) : (
        <div className="space-y-3">
          {progress.map((entry) => (
            <div
              key={entry.id}
              className="bg-[var(--background)] border border-[var(--border-color)] rounded-lg p-4 hover:border-[var(--accent)]/50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-bold text-[var(--foreground)]">
                      Page {entry.currentPage}
                    </span>
                    <span className="text-sm text-[var(--subheading-text)] font-medium">
                      ({entry.currentPercentage}%)
                    </span>
                    <span className="text-xs text-[var(--accent)] font-semibold">
                      +{entry.pagesRead} pages
                    </span>
                  </div>
                  <p className="text-sm text-[var(--subheading-text)] font-mono font-semibold">
                    {formatDateOnly(entry.progressDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(entry)}
                    className="p-1 hover:bg-[var(--card-bg)] rounded transition-colors"
                    title="Edit progress entry"
                  >
                    <Edit2 className="w-4 h-4 text-[var(--accent)]" />
                  </button>
                  <button
                    onClick={() => onEdit(entry)}
                    className="p-1 hover:bg-[var(--card-bg)] rounded transition-colors"
                    title="Delete progress entry"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              {entry.notes && (
                <p className="text-sm text-[var(--foreground)]/70 mt-2 italic font-medium border-l-2 border-[var(--accent)]/30 pl-3">
                  &quot;{entry.notes}&quot;
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
