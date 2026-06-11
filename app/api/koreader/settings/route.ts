import { NextRequest, NextResponse } from 'next/server';
import { settingsRepository } from '@/lib/repositories/settings.repository';
import { getLogger } from '@/lib/logger';

const logger = getLogger().child({ module: 'koreader-settings-api' });

/**
 * GET /api/koreader/settings
 * 
 * Get all KoReader-related settings or specific settings by keys
 * 
 * Query params:
 * - keys: Comma-separated list of setting keys (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keysParam = searchParams.get('keys');

    if (keysParam) {
      const keys = keysParam.split(',').map(k => k.trim());
      const settings = await settingsRepository.getMany(keys);
      
      // Convert Map to object for JSON response
      const result: Record<string, string> = {};
      settings.forEach((value, key) => {
        result[key] = value;
      });
      
      return NextResponse.json(result);
    }

    // Get all settings and filter for KoReader-related ones
    const allSettings = await settingsRepository.getAll();
    const koreaderSettings = allSettings.filter(s => s.key.startsWith('koreader_'));
    
    return NextResponse.json(koreaderSettings);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch settings');
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/koreader/settings
 * 
 * Update multiple settings at once
 * 
 * Body: Record<string, string | number | boolean>
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be an object of key-value pairs' },
        { status: 400 }
      );
    }

    // Update each setting
    const updates = Object.entries(body);
    for (const [key, value] of updates) {
      // Validate value type
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return NextResponse.json(
          { error: `Invalid value type for key "${key}". Must be string, number, or boolean` },
          { status: 400 }
        );
      }
      await settingsRepository.set(key, value);
    }

    logger.info({ count: updates.length }, 'Updated settings');

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    logger.error({ error }, 'Failed to update settings');
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
