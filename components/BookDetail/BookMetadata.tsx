import { Button } from "@/components/Utilities/Button";

interface BookMetadataProps {
  hasTotalPages: boolean;
  totalPagesInput: string;
  onTotalPagesChange: (value: string) => void;
  onTotalPagesSubmit: (e: React.FormEvent) => void;
}

export default function BookMetadata({
  hasTotalPages,
  totalPagesInput,
  onTotalPagesChange,
  onTotalPagesSubmit,
}: BookMetadataProps) {
  // Only show if book doesn't have total pages
  if (hasTotalPages) {
    return null;
  }

  return (
    <div className="border-l-4 border-[var(--accent)] bg-[var(--card-bg)] pl-4 pr-4 py-3 max-w-md rounded-sm">
      <p className="text-sm text-[var(--foreground)]/70 mb-3 font-medium">
        Add page count to enable progress tracking
      </p>
      <form onSubmit={onTotalPagesSubmit} className="flex gap-2">
        <input
          type="number"
          value={totalPagesInput}
          onChange={(e) => onTotalPagesChange(e.target.value)}
          min="1"
          className="flex-1 px-3 py-2 border border-[var(--border-color)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          placeholder="e.g. 320"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="rounded-sm"
        >
          Save
        </Button>
      </form>
    </div>
  );
}
