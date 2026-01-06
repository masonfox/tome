import { vi } from 'vitest';

const createMockLogger = (): any => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

export const getLogger = createMockLogger;
export const getBaseLogger = createMockLogger;
export const createLogger = vi.fn(createMockLogger);
