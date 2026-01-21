/**
 * Demo mode utilities
 *
 * When NODE_ENV=demo, the application runs in read-only mode.
 * All data mutations are blocked at the middleware level.
 */

export function isDemoMode(): boolean {
  return process.env.NODE_ENV === "demo";
}

export function getDemoConfig() {
  return {
    enabled: isDemoMode(),
    message: "This is a read-only demo. Changes are not saved.",
  };
}
