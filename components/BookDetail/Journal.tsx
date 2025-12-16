import { JournalEntryList, type JournalEntry } from "@/components/Journal/JournalEntryList";

interface JournalProps {
  progress: JournalEntry[];
  onEdit: (entry: JournalEntry) => void;
}

export default function Journal({ progress, onEdit }: JournalProps) {
  return (
    <JournalEntryList
      entries={progress}
      onEdit={onEdit}
      title="Journal"
      emptyMessage="No progress logged yet"
    />
  );
}
