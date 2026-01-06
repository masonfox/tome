"use client";

import { Toaster } from "sonner";
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      expand={false}
      richColors={false}
      duration={3000}
      icons={{
        success: <CheckCircle2 className="w-5 h-5" />,
        error: <XCircle className="w-5 h-5" />,
        info: <Info className="w-5 h-5" />,
        warning: <AlertTriangle className="w-5 h-5" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "bg-[var(--card-bg)] border-[var(--border-color)] text-[var(--foreground)] shadow-lg font-sans",
          title: "font-semibold text-[var(--foreground)]",
          description: "text-[var(--foreground)]/70 font-medium",
          actionButton: "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)]",
          cancelButton: "bg-[var(--border-color)] text-[var(--foreground)]",
          success: "tome-toast-success",
          error: "tome-toast-error",
          info: "tome-toast-info",
          warning: "tome-toast-warning",
        },
        style: {
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
          fontWeight: "500",
        },
      }}
    />
  );
}
