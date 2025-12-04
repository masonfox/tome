"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import BaseModal from "./BaseModal";

export function DataWipeSettings() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);
  const CONFIRM_MESSAGE = "DELETE ALL DATA";

  async function handleWipeData() {
    // Validate confirmation text
    if (confirmText !== CONFIRM_MESSAGE) {
      toast.error(`Please type "${CONFIRM_MESSAGE}" to confirm`);
      return;
    }

    setWiping(true);
    try {
      const res = await fetch("/api/data/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const syncCount = data.syncResult?.totalBooks || 0;
        const message = data.syncError 
          ? "Data wiped, but sync failed. Please sync manually." 
          : `Data wiped and ${syncCount} books synced from Calibre!`;
        
        toast.success(message);
        setConfirmText("");
        setIsModalOpen(false);
        
        // Redirect to library page after a brief delay
        setTimeout(() => {
          window.location.href = "/library";
        }, 1500);
      } else {
        toast.error(data.error || "Failed to wipe data");
      }
    } catch (error) {
      toast.error("Failed to wipe data");
    } finally {
      setWiping(false);
    }
  }

  function handleCloseModal() {
    if (!wiping) {
      setIsModalOpen(false);
      setConfirmText("");
    }
  }

  return (
    <>
      <div className="bg-[var(--card-bg)] border border-red-500/30 rounded-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="w-6 h-6 text-red-500" />
          <h3 className="text-xl font-serif font-bold text-red-500">
            Danger Zone
          </h3>
        </div>

        <p className="text-sm text-[var(--subheading-text)] mb-4 font-medium">
          Permanently delete all of your data.
        </p>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-red-500 text-white rounded-sm hover:bg-red-600 transition-colors font-semibold flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Wipe All Data
        </button>
      </div>

      <BaseModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Delete All Data"
        subtitle="This action cannot be undone"
        actions={
          <div className="flex gap-3">
            <button
              onClick={handleCloseModal}
              disabled={wiping}
              className="flex-1 px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] rounded-sm hover:bg-[var(--card-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleWipeData}
              disabled={wiping || confirmText !== CONFIRM_MESSAGE}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
            >
              {wiping && <Loader2 className="w-4 h-4 animate-spin" />}
              {wiping ? "Wiping..." : "Delete"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-sm p-4">
            <p className="text-sm text-red-600 dark:text-red-400 font-semibold mb-2">
              ⚠️ Warning: This will delete:
            </p>
            <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 ml-4 list-disc">
              <li>All books and reading sessions</li>
              <li>All progress logs and history</li>
              <li>All reading streaks</li>
              <li>All import logs and data</li>
              <li>All settings and preferences</li>
            </ul>
          </div>

          <p className="text-sm text-[var(--subheading-text)] italic">
            Note: Calibre sync will run automatically after the wipe to reimport your books.
          </p>

          <div>
            <label
              htmlFor="confirm-text"
              className="block text-sm font-semibold text-[var(--foreground)]/70 mb-2"
            >
              Type <span className="font-mono text-red-500">{CONFIRM_MESSAGE}</span> to confirm
            </label>
            <input
              id="confirm-text"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_MESSAGE}
              className="w-full px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-sm text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={wiping}
            />
          </div>
        </div>
      </BaseModal>
    </>
  );
}
