import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { isWalMode, detectJournalMode } from '@/lib/db/factory';

describe('WAL Mode Detection', () => {
  const testDir = join(process.cwd(), '__tests__', 'fixtures', 'wal-detection');
  const dbPath = join(testDir, 'test.db');
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;

  beforeEach(() => {
    // Create test directory and db file
    mkdirSync(testDir, { recursive: true });
    writeFileSync(dbPath, 'fake db content');
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('isWalMode', () => {
    test('returns true when -wal file exists', () => {
      writeFileSync(walPath, 'fake wal content');
      expect(isWalMode(dbPath)).toBe(true);
    });

    test('returns false when -wal file does not exist', () => {
      expect(isWalMode(dbPath)).toBe(false);
    });

    test('returns true when both -wal and -shm exist', () => {
      writeFileSync(walPath, 'fake wal content');
      writeFileSync(shmPath, 'fake shm content');
      expect(isWalMode(dbPath)).toBe(true);
    });

    test('returns true with only -wal file (shm missing)', () => {
      writeFileSync(walPath, 'fake wal content');
      // Don't create shm file
      expect(isWalMode(dbPath)).toBe(true);
    });

    test('returns false when only -shm exists (wal missing)', () => {
      writeFileSync(shmPath, 'fake shm content');
      // Don't create wal file
      expect(isWalMode(dbPath)).toBe(false);
    });

    test('handles non-existent database path gracefully', () => {
      const nonExistentPath = join(testDir, 'nonexistent.db');
      expect(isWalMode(nonExistentPath)).toBe(false);
    });

    test('handles paths with special characters', () => {
      const specialPath = join(testDir, 'test with spaces.db');
      writeFileSync(specialPath, 'content');
      expect(isWalMode(specialPath)).toBe(false);
      
      writeFileSync(`${specialPath}-wal`, 'wal content');
      expect(isWalMode(specialPath)).toBe(true);
    });
  });

  describe('detectJournalMode', () => {
    test('returns "wal" when WAL files exist', () => {
      writeFileSync(walPath, 'fake wal content');
      expect(detectJournalMode(dbPath)).toBe('wal');
    });

    test('returns "delete" when WAL files do not exist', () => {
      expect(detectJournalMode(dbPath)).toBe('delete');
    });

    test('returns "wal" when both -wal and -shm exist', () => {
      writeFileSync(walPath, 'fake wal content');
      writeFileSync(shmPath, 'fake shm content');
      expect(detectJournalMode(dbPath)).toBe('wal');
    });

    test('returns "delete" for non-existent database path', () => {
      const nonExistentPath = join(testDir, 'nonexistent.db');
      expect(detectJournalMode(nonExistentPath)).toBe('delete');
    });

    test('returns "delete" when only shm exists (incomplete WAL state)', () => {
      writeFileSync(shmPath, 'fake shm content');
      expect(detectJournalMode(dbPath)).toBe('delete');
    });
  });

  describe('Real-world scenarios', () => {
    test('detects Calibre 9.x WAL mode pattern', () => {
      // Simulate Calibre 9.x creating WAL files
      writeFileSync(walPath, Buffer.alloc(1024)); // Realistic WAL file size
      writeFileSync(shmPath, Buffer.alloc(32768)); // Realistic SHM file size (32KB)
      
      expect(isWalMode(dbPath)).toBe(true);
      expect(detectJournalMode(dbPath)).toBe('wal');
    });

    test('detects older Calibre DELETE mode pattern', () => {
      // Older Calibre versions without WAL files
      expect(isWalMode(dbPath)).toBe(false);
      expect(detectJournalMode(dbPath)).toBe('delete');
    });

    test('handles empty WAL file (database just created)', () => {
      writeFileSync(walPath, ''); // Empty WAL file
      expect(isWalMode(dbPath)).toBe(true);
      expect(detectJournalMode(dbPath)).toBe('wal');
    });
  });
});
