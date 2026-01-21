/**
 * Demo mode utilities
 *
 * When DEMO_MODE=true, the application runs in read-only mode.
 * All data mutations are blocked at the middleware level.
 */

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function getDemoConfig() {
  return {
    enabled: isDemoMode(),
    message: "This is a read-only demo. Changes are not saved.",
  };
}
