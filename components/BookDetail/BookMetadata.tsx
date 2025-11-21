import Link from "next/link";

interface BookMetadataProps {
  book: {
    description?: string;
    tags: string[];
  };
  hasTotalPages: boolean;
  totalPagesInput: string;
  onTotalPagesChange: (value: string) => void;
  onTotalPagesSubmit: (e: React.FormEvent) => void;
}

export default function BookMetadata({
  book,
  hasTotalPages,
  totalPagesInput,
  onTotalPagesChange,
  onTotalPagesSubmit,
}: BookMetadataProps) {
  return (
    <div className="space-y-6">
      {/* Pages Setting - Only show if book doesn't have total pages */}
      {!hasTotalPages && (
        <div className="border-l-4 border-[var(--accent)] bg-[var(--card-bg)] pl-4 py-3">
          <p className="text-sm text-[var(--foreground)]/70 mb-3 font-medium">
            Add page count to enable progress tracking
          </p>
          <form onSubmit={onTotalPagesSubmit} className="flex gap-2 max-w-xs">
            <input
              type="number"
              value={totalPagesInput}
              onChange={(e) => onTotalPagesChange(e.target.value)}
              min="1"
              className="flex-1 px-3 py-2 border border-[var(--border-color)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="e.g. 320"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-sm text-sm hover:bg-[var(--light-accent)] transition-colors font-semibold"
            >
              Save
            </button>
          </form>
        </div>
      )}

      {/* Description */}
      {book.description && (
        <div>
          <p className="text-sm text-[var(--foreground)]/80 leading-relaxed font-medium">
            {book.description.replace(/<[^>]*>/g, "")}
          </p>
        </div>
      )}

      {/* Tags */}
      {book.tags.length > 0 && (
        <div>
          <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 mb-3 font-semibold">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {book.tags.map((tag) => (
              <Link
                key={tag}
                href={`/library?tags=${encodeURIComponent(tag)}`}
                className="px-3 py-1 bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 rounded text-sm transition-colors font-medium"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
