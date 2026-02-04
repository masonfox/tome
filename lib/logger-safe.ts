/**
 * Safe logger getter that works in both production and test environments
 * In tests, returns a no-op logger to avoid module resolution issues
 */
export function getLoggerSafe() {
  if (process.env.NODE_ENV === 'test') {
    return {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
      fatal: () => {},
    };
  }

  // In production, use the real logger
  const { getLogger } = require("./logger");
  return getLogger();
}
