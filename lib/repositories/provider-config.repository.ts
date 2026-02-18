/**
 * Provider Config Repository
 * 
 * Manages CRUD operations for metadata provider configurations.
 * Stores runtime settings, credentials, and enabled state.
 */

import { eq } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
  providerConfigs,
  ProviderConfig,
  NewProviderConfig,
} from "@/lib/db/schema/provider-configs";
import type { ProviderId } from "@/lib/providers/base/IMetadataProvider";

export class ProviderConfigRepository extends BaseRepository<
  ProviderConfig,
  NewProviderConfig,
  typeof providerConfigs
> {
  constructor() {
    super(providerConfigs);
  }

  protected getTable() {
    return providerConfigs;
  }

  /**
   * Find provider config by provider ID
   */
  async findByProvider(provider: ProviderId): Promise<ProviderConfig | undefined> {
    return this.getDatabase()
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.provider, provider))
      .get();
  }

  /**
   * Find all enabled providers ordered by priority
   */
  async findEnabled(): Promise<ProviderConfig[]> {
    return this.getDatabase()
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.enabled, true))
      .orderBy(providerConfigs.priority)
      .all();
  }

  /**
   * Update provider enabled state
   */
  async setEnabled(provider: ProviderId, enabled: boolean): Promise<ProviderConfig | undefined> {
    const existing = await this.findByProvider(provider);
    if (!existing) {
      return undefined;
    }

    return this.update(existing.id, { enabled });
  }

  /**
   * Update provider settings
   */
  async updateSettings(
    provider: ProviderId,
    settings: Record<string, unknown>
  ): Promise<ProviderConfig | undefined> {
    const existing = await this.findByProvider(provider);
    if (!existing) {
      return undefined;
    }

    return this.update(existing.id, { settings });
  }

  /**
   * Update provider credentials
   */
  async updateCredentials(
    provider: ProviderId,
    credentials: Record<string, string>
  ): Promise<ProviderConfig | undefined> {
    const existing = await this.findByProvider(provider);
    if (!existing) {
      return undefined;
    }

    return this.update(existing.id, { credentials });
  }
}

// Export singleton instance
export const providerConfigRepository = new ProviderConfigRepository();
