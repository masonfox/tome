"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      expand={false}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--foreground)] shadow-lg font-serif",
          title: "font-semibold text-[var(--foreground)]",
          description: "text-[var(--foreground)]/70",
          actionButton: "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]",
          cancelButton: "bg-[var(--border-color)] text-[var(--foreground)]",
          closeButton: "bg-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white",
          success: "border-green-600/30 bg-green-50 dark:bg-green-950/30",
          error: "border-red-600/30 bg-red-50 dark:bg-red-950/30",
          info: "border-blue-600/30 bg-blue-50 dark:bg-blue-950/30",
          warning: "border-amber-600/30 bg-amber-50 dark:bg-amber-950/30",
        },
        style: {
          fontFamily: "'Lora', 'Crimson Text', serif",
        },
      }}
    />
  );
}
