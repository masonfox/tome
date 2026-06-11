import { eq, sql } from 'drizzle-orm';
import { getDatabase } from '@/lib/db/context';
import { applicationSettings, type ApplicationSetting } from '@/lib/db/schema/koreader';

/**
 * Repository for application-wide settings (key-value store)
 * Used for KoReader proxy configuration and other global settings
 */
class SettingsRepository {
  /**
   * Get a setting by key
   * @returns The setting value or null if not found
   */
  async get(key: string): Promise<string | null> {
    const db = getDatabase();
    const setting = db.select()
      .from(applicationSettings)
      .where(eq(applicationSettings.key, key))
      .get();
    return setting?.value || null;
  }

  /**
   * Get a setting as a boolean
   * @returns true if value is 'true', false otherwise
   */
  async getBoolean(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value === 'true';
  }

  /**
   * Get a setting as a number
   * @returns The numeric value or null if not found or not a number
   */
  async getNumber(key: string): Promise<number | null> {
    const value = await this.get(key);
    if (!value) return null;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Set a setting value (creates or updates)
   */
  async set(key: string, value: string | boolean | number): Promise<void> {
    const db = getDatabase();
    const stringValue = String(value);
    
    db.insert(applicationSettings)
      .values({ key, value: stringValue })
      .onConflictDoUpdate({
        target: applicationSettings.key,
        set: { value: stringValue, updatedAt: new Date() },
      })
      .run();
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<ApplicationSetting[]> {
    const db = getDatabase();
    return db.select().from(applicationSettings).all();
  }

  /**
   * Delete a setting by key
   */
  async delete(key: string): Promise<boolean> {
    const db = getDatabase();
    const result = db.delete(applicationSettings)
      .where(eq(applicationSettings.key, key))
      .run() as unknown as { changes: number };
    return result.changes > 0;
  }

  /**
   * Get multiple settings by keys
   * @returns Map of key to value
   */
  async getMany(keys: string[]): Promise<Map<string, string>> {
    const db = getDatabase();
    const results = db.select()
      .from(applicationSettings)
      .where(sql`${applicationSettings.key} IN ${keys}`)
      .all();
    
    return new Map(results.map(r => [r.key, r.value]));
  }
}

export const settingsRepository = new SettingsRepository();
