/**
 * Button style utilities matching the elegant serif theme
 */

export const buttonStyles = {
  primary: "bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] shadow-md hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed",
  secondary: "border border-[var(--border-color)] text-[var(--foreground)] rounded-md hover:bg-[var(--card-bg)] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed",
  tertiary: "text-[var(--accent)] hover:text-[var(--light-accent)] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed",
  danger: "bg-red-600 text-white rounded-md hover:bg-red-700 shadow-md hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed",
  "icon-danger": "p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  disabled: "opacity-50 cursor-not-allowed",
};

export const inputStyles =
  "px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors";

export const selectStyles =
  "px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors";
