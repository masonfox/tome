import { useState } from "react";
import { toast } from "@/utils/toast";
import { getTodayLocalDate } from '@/utils/dateHelpers';
import { sessionApi } from "@/lib/api";

interface Session {
  id: number;
  startedDate?: string | null;
}

export function useSessionDetails(
  bookId: string,
  session: Session | null | undefined,
  onRefresh: () => void
) {
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");

  function startEditing() {
    if (session?.startedDate) {
      setEditStartDate(session.startedDate.split("T")[0]);
    } else {
      setEditStartDate(getTodayLocalDate());
    }
    setIsEditingStartDate(true);
  }

  function cancelEditing() {
    setIsEditingStartDate(false);
    setEditStartDate("");
  }

  async function saveStartDate() {
    if (!session?.id) return;

    try {
      const startedISO = editStartDate
        ? new Date(editStartDate + "T00:00:00.000Z").toISOString()
        : null;

      await sessionApi.update(bookId, session.id, { startedDate: startedISO });

      setIsEditingStartDate(false);
      toast.success("Start date updated");
      onRefresh();
    } catch (error) {
      toast.error("Failed to update start date");
    }
  }

  return {
    isEditingStartDate,
    editStartDate,
    setEditStartDate,
    startEditing,
    cancelEditing,
    saveStartDate,
  };
}
