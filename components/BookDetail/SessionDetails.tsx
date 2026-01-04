import { Calendar, Pencil } from "lucide-react";
import { formatDateOnly, getTodayLocalDate } from '@/utils/dateHelpers';

interface SessionDetailsProps {
  startedDate: string | null | undefined;
  isEditingStartDate: boolean;
  editStartDate: string;
  onStartEditingDate: () => void;
  onEditStartDateChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveStartDate: () => void;
}

export default function SessionDetails({
  startedDate,
  isEditingStartDate,
  editStartDate,
  onStartEditingDate,
  onEditStartDateChange,
  onCancelEdit,
  onSaveStartDate,
}: SessionDetailsProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Calendar className="w-4 h-4 text-[var(--accent)]" />
      <span className="font-bold text-[var(--accent)]">Started:</span>
      {isEditingStartDate ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={editStartDate}
            onChange={(e) => onEditStartDateChange(e.target.value)}
            max={getTodayLocalDate()}
            className="px-2 py-1 border border-[var(--border-color)] rounded bg-[var(--background)] text-[var(--foreground)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] max-h-[42px] text-left"
          />
          <button
            onClick={onCancelEdit}
            className="px-2 py-1 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] rounded text-xs font-semibold hover:bg-[var(--background)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSaveStartDate}
            className="px-2 py-1 bg-[var(--accent)] text-white rounded text-xs font-semibold hover:bg-[var(--light-accent)] transition-colors"
          >
            Save
          </button>
        </div>
      ) : (
        <button
          onClick={onStartEditingDate}
          className="flex items-center gap-1 group"
          title="Click to edit start date"
        >
          {startedDate ? (
            <span className="font-medium text-[var(--foreground)] group-hover:underline">
              {formatDateOnly(startedDate)}
            </span>
          ) : (
            <span className="italic text-[var(--foreground)]/40 font-medium group-hover:underline">
              Not set
            </span>
          )}
          <Pencil className="w-3.5 h-3.5 text-[var(--subheading-text)]" />
        </button>
      )}
    </div>
  );
}
