"use client";

import { Toaster } from "sonner";
import { BookCheck, BookX, BookOpen, AlertTriangle } from "lucide-react";

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      expand={false}
      richColors={false}
      closeButton
      icons={{
        success: <BookCheck className="w-5 h-5" />,
        error: <BookX className="w-5 h-5" />,
        info: <BookOpen className="w-5 h-5" />,
        warning: <AlertTriangle className="w-5 h-5" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--foreground)] shadow-lg font-serif",
          title: "font-semibold text-[var(--foreground)]",
          description: "text-[var(--foreground)]/70",
          actionButton: "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]",
          cancelButton: "bg-[var(--border-color)] text-[var(--foreground)]",
          closeButton: "bg-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-white",
          success: "tome-toast-success",
          error: "tome-toast-error",
          info: "tome-toast-info",
          warning: "tome-toast-warning",
        },
        style: {
          fontFamily: "'Lora', 'Crimson Text', serif",
        },
      }}
    />
  );
}
