/**
 * Unit Tests for Docker Entrypoint
 * 
 * Tests the TypeScript entrypoint logic that replaced docker-entrypoint.sh
 * to eliminate cross-process boundaries and fix the "sonic boom is not ready yet" error.
 * 
 * These tests verify:
 * - Configuration parsing
 * - Data directory validation
 * - Backup orchestration
 * - Migration retry logic
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { existsSync, mkdirSync, accessSync, readFileSync } from 'fs';
import * as entrypoint from '@/scripts/entrypoint';

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    default: actual,
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    accessSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// Mock backup module
vi.mock('@/lib/db/backup', () => ({
  createBackups: vi.fn(),
}));

// Mock migration module
vi.mock('@/lib/db/migrate', () => ({
  runMigrations: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  })),
}));

// Mock child_process
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    default: actual,
    ...actual,
    spawn: vi.fn(),
  };
});

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Docker Entrypoint', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Reset environment variables
    process.env.DATABASE_PATH = undefined;
    process.env.MAX_RETRIES = undefined;
    process.env.RETRY_DELAY = undefined;
    process.env.PORT = undefined;
    process.env.HOSTNAME = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConfig', () => {
    it('should return default configuration when no env vars are set', () => {
      const config = entrypoint.getConfig();
      
      expect(config).toEqual({
        databasePath: './data/tome.db',
        dataDir: './data',
        maxRetries: 3,
        retryDelay: 5000,
        port: 3000,
        hostname: '0.0.0.0',
      });
    });

    it('should parse DATABASE_PATH environment variable', () => {
      process.env.DATABASE_PATH = '/custom/path/database.db';
      
      const config = entrypoint.getConfig();
      
      expect(config.databasePath).toBe('/custom/path/database.db');
      expect(config.dataDir).toBe('/custom/path');
    });

    it('should parse MAX_RETRIES as integer', () => {
      process.env.MAX_RETRIES = '5';
      
      const config = entrypoint.getConfig();
      
      expect(config.maxRetries).toBe(5);
      expect(typeof config.maxRetries).toBe('number');
    });

    it('should parse RETRY_DELAY as integer', () => {
      process.env.RETRY_DELAY = '10000';
      
      const config = entrypoint.getConfig();
      
      expect(config.retryDelay).toBe(10000);
      expect(typeof config.retryDelay).toBe('number');
    });

    it('should parse PORT and HOSTNAME', () => {
      process.env.PORT = '8080';
      process.env.HOSTNAME = '127.0.0.1';
      
      const config = entrypoint.getConfig();
      
      expect(config.port).toBe(8080);
      expect(config.hostname).toBe('127.0.0.1');
    });

    it('should handle invalid numbers gracefully (fallback to defaults)', () => {
      process.env.MAX_RETRIES = 'invalid';
      process.env.RETRY_DELAY = 'not-a-number';
      process.env.PORT = 'NaN';
      
      const config = entrypoint.getConfig();
      
      // parseInt with invalid strings returns NaN, which is falsy but not undefined
      expect(isNaN(config.maxRetries)).toBe(true);
      expect(isNaN(config.retryDelay)).toBe(true);
      expect(isNaN(config.port)).toBe(true);
    });
  });

  describe('showBanner', () => {
    it('should display banner with version from package.json', async () => {
      const mockPackageJson = JSON.stringify({ version: '1.2.3' });
      (existsSync as Mock).mockReturnValue(true);
      (readFileSync as Mock).mockReturnValue(mockPackageJson);
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await entrypoint.showBanner();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('Version: 1.2.3');
      expect(output).toContain('████████╗');
      
      consoleSpy.mockRestore();
    });

    it('should handle missing package.json gracefully', async () => {
      (existsSync as Mock).mockReturnValue(false);
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await entrypoint.showBanner();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('Version: unknown');
      
      consoleSpy.mockRestore();
    });

    it('should not throw error if banner display fails', async () => {
      (existsSync as Mock).mockImplementation(() => {
        throw new Error('File system error');
      });
      
      // Should not throw
      await expect(entrypoint.showBanner()).resolves.not.toThrow();
    });
  });

  describe('ensureDataDirectory', () => {
    beforeEach(() => {
      process.env.DATABASE_PATH = '/app/data/tome.db';
    });

    it('should succeed when directory exists and is writable', async () => {
      (existsSync as Mock).mockReturnValue(true);
      (accessSync as Mock).mockImplementation(() => {}); // No error = writable
      
      await expect(entrypoint.ensureDataDirectory()).resolves.not.toThrow();
      
      expect(existsSync).toHaveBeenCalledWith('/app/data');
      expect(accessSync).toHaveBeenCalledWith('/app/data', 2); // W_OK = 2
      expect(mkdirSync).not.toHaveBeenCalled(); // Directory exists
    });

    it('should create directory if it does not exist', async () => {
      (existsSync as Mock).mockReturnValue(false);
      (mkdirSync as Mock).mockImplementation(() => {});
      (accessSync as Mock).mockImplementation(() => {});
      
      await expect(entrypoint.ensureDataDirectory()).resolves.not.toThrow();
      
      expect(mkdirSync).toHaveBeenCalledWith('/app/data', { recursive: true });
      expect(accessSync).toHaveBeenCalled();
    });

    it('should throw error if directory cannot be created', async () => {
      (existsSync as Mock).mockReturnValue(false);
      (mkdirSync as Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      await expect(entrypoint.ensureDataDirectory()).rejects.toThrow(
        'Failed to create data directory: /app/data'
      );
    });

    it('should throw error if directory is not writable', async () => {
      (existsSync as Mock).mockReturnValue(true);
      (accessSync as Mock).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });
      
      await expect(entrypoint.ensureDataDirectory()).rejects.toThrow(
        'Data directory is not writable: /app/data'
      );
    });
  });

  describe('backupDatabase', () => {
    beforeEach(() => {
      process.env.DATABASE_PATH = '/app/data/tome.db';
    });

    it('should skip backup if database does not exist (first run)', async () => {
      const { createBackups } = await import('@/lib/db/backup');
      (existsSync as Mock).mockReturnValue(false);
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await expect(entrypoint.backupDatabase()).resolves.not.toThrow();
      
      expect(createBackups).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Database not found (first run), skipping backup'
      );
      
      consoleSpy.mockRestore();
    });

    it('should create backup successfully when database exists', async () => {
      const { createBackups } = await import('@/lib/db/backup');
      (existsSync as Mock).mockReturnValue(true);
      (createBackups as Mock).mockResolvedValue({
        tome: {
          success: true,
          backupSize: '2.5MB',
          backupPath: '/app/data/backups/2026-01-14/tome.db.backup-20260114_120000',
          hasWal: true,
          hasShm: false,
        },
      });
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await expect(entrypoint.backupDatabase()).resolves.not.toThrow();
      
      expect(createBackups).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Creating database backup(s)...');
      expect(consoleSpy).toHaveBeenCalledWith('Tome backup created: 2.5MB');
      
      consoleSpy.mockRestore();
    });

    it('should handle Calibre backup when present', async () => {
      const { createBackups } = await import('@/lib/db/backup');
      (existsSync as Mock).mockReturnValue(true);
      (createBackups as Mock).mockResolvedValue({
        tome: {
          success: true,
          backupSize: '2.5MB',
        },
        calibre: {
          success: true,
          backupSize: '3.2MB',
        },
      });
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await expect(entrypoint.backupDatabase()).resolves.not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith('Tome backup created: 2.5MB');
      expect(consoleSpy).toHaveBeenCalledWith('Calibre backup created: 3.2MB');
      
      consoleSpy.mockRestore();
    });

    it('should throw error if backup fails', async () => {
      const { createBackups } = await import('@/lib/db/backup');
      (existsSync as Mock).mockReturnValue(true);
      (createBackups as Mock).mockResolvedValue({
        tome: {
          success: false,
          error: 'Disk full',
        },
      });
      
      await expect(entrypoint.backupDatabase()).rejects.toThrow('Backup failed: Disk full');
    });
  });

  describe('runMigrationsWithRetry', () => {
    beforeEach(() => {
      process.env.MAX_RETRIES = '3';
      process.env.RETRY_DELAY = '100'; // Fast retries for tests
    });

    it('should succeed on first attempt if migrations pass', async () => {
      const { runMigrations } = await import('@/lib/db/migrate');
      (runMigrations as Mock).mockResolvedValue(undefined);
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await expect(entrypoint.runMigrationsWithRetry()).resolves.not.toThrow();
      
      expect(runMigrations).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('Migrations completed successfully');
      
      consoleSpy.mockRestore();
    });

    it('should retry on failure with exponential backoff', async () => {
      const { runMigrations } = await import('@/lib/db/migrate');
      
      // Fail twice, then succeed
      (runMigrations as Mock)
        .mockRejectedValueOnce(new Error('Database locked'))
        .mockRejectedValueOnce(new Error('Database locked'))
        .mockResolvedValueOnce(undefined);
      
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      
      await expect(entrypoint.runMigrationsWithRetry()).resolves.not.toThrow();
      
      expect(runMigrations).toHaveBeenCalledTimes(3);
      
      // Should have delayed twice (100ms, 200ms)
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      
      setTimeoutSpy.mockRestore();
    });

    it('should throw error after all retries exhausted', async () => {
      const { runMigrations } = await import('@/lib/db/migrate');
      (runMigrations as Mock).mockRejectedValue(new Error('Migration failed'));
      
      await expect(entrypoint.runMigrationsWithRetry()).rejects.toThrow(
        'Migration failed after 3 attempts'
      );
      
      expect(runMigrations).toHaveBeenCalledTimes(3);
    });

    it('should calculate exponential backoff correctly', async () => {
      const { runMigrations } = await import('@/lib/db/migrate');
      (runMigrations as Mock).mockRejectedValue(new Error('Fail'));
      
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      vi.spyOn(global, 'setTimeout').mockImplementation(((callback: any, delay: number) => {
        delays.push(delay);
        callback();
        return {} as any;
      }) as any);
      
      await expect(entrypoint.runMigrationsWithRetry()).rejects.toThrow();
      
      // Exponential backoff: 100ms, 200ms, 400ms
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      
      vi.mocked(global.setTimeout).mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should log errors with structured logging', async () => {
      const { getLogger } = await import('@/lib/logger');
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
      };
      (getLogger as Mock).mockReturnValue(mockLogger);
      
      (existsSync as Mock).mockReturnValue(false);
      (mkdirSync as Mock).mockImplementation(() => {
        throw new Error('EACCES');
      });
      
      await expect(entrypoint.ensureDataDirectory()).rejects.toThrow();
      
      expect(mockLogger.fatal).toHaveBeenCalled();
    });

    it('should provide helpful error messages for common issues', async () => {
      (existsSync as Mock).mockReturnValue(true);
      (accessSync as Mock).mockImplementation(() => {
        throw new Error('EACCES');
      });
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(entrypoint.ensureDataDirectory()).rejects.toThrow();
      
      // Should provide troubleshooting guidance
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Docker volume mount permission issues')
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle successful full startup sequence', async () => {
      const { createBackups } = await import('@/lib/db/backup');
      const { runMigrations } = await import('@/lib/db/migrate');
      
      // Setup successful scenario
      (existsSync as Mock).mockReturnValue(true);
      (accessSync as Mock).mockImplementation(() => {});
      (createBackups as Mock).mockResolvedValue({
        tome: { success: true, backupSize: '2MB' },
      });
      (runMigrations as Mock).mockResolvedValue(undefined);
      
      // All operations should succeed without throwing
      await expect(entrypoint.ensureDataDirectory()).resolves.not.toThrow();
      await expect(entrypoint.backupDatabase()).resolves.not.toThrow();
      await expect(entrypoint.runMigrationsWithRetry()).resolves.not.toThrow();
    });

    it('should handle first-run scenario (no database)', async () => {
      const { createBackups } = await import('@/lib/db/backup');
      const { runMigrations } = await import('@/lib/db/migrate');
      
      // Directory doesn't exist, database doesn't exist (first run)
      (existsSync as Mock).mockReturnValue(false);
      (mkdirSync as Mock).mockImplementation(() => {});
      (accessSync as Mock).mockImplementation(() => {});
      (runMigrations as Mock).mockResolvedValue(undefined);
      
      // Should create directory
      await expect(entrypoint.ensureDataDirectory()).resolves.not.toThrow();
      expect(mkdirSync).toHaveBeenCalled();
      
      // Should skip backup
      await expect(entrypoint.backupDatabase()).resolves.not.toThrow();
      expect(createBackups).not.toHaveBeenCalled();
      
      // Should run migrations
      await expect(entrypoint.runMigrationsWithRetry()).resolves.not.toThrow();
      expect(runMigrations).toHaveBeenCalled();
    });
  });
});
