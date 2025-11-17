/**
 * Button style utilities matching the elegant serif theme
 */

export const buttonStyles = {
  primary: "bg-[var(--accent)] text-white hover:bg-[var(--light-accent)] transition-colors font-semibold",
  secondary: "border border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors",
  tertiary: "text-[var(--accent)] hover:text-[var(--light-accent)] transition-colors font-semibold",
  danger: "bg-red-600 text-white hover:bg-red-700 transition-colors font-semibold",
  disabled: "opacity-50 cursor-not-allowed",
};

export const inputStyles =
  "px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors";

export const selectStyles =
  "px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors";
