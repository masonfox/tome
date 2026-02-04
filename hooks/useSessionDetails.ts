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
      // Send YYYY-MM-DD format directly - backend expects this format
      await sessionApi.update(bookId, session.id, { 
        startedDate: editStartDate || null 
      });

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
