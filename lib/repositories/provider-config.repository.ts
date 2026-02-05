/**
 * Provider Config Repository
 * 
 * Manages CRUD operations for metadata provider configurations.
 * Stores runtime settings, credentials, health status, and circuit breaker state.
 */

import { eq } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
  providerConfigs,
  ProviderConfig,
  NewProviderConfig,
} from "@/lib/db/schema/provider-configs";
import type { BookSource } from "@/lib/providers/base/IMetadataProvider";

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
  async findByProvider(provider: BookSource): Promise<ProviderConfig | undefined> {
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
  async setEnabled(provider: BookSource, enabled: boolean): Promise<ProviderConfig | undefined> {
    const existing = await this.findByProvider(provider);
    if (!existing) {
      return undefined;
    }

    return this.update(existing.id, { enabled });
  }

  /**
   * Update provider health status
   */
  async updateHealth(
    provider: BookSource,
    healthStatus: ProviderConfig["healthStatus"],
    lastHealthCheck: Date
  ): Promise<ProviderConfig | undefined> {
    const existing = await this.findByProvider(provider);
    if (!existing) {
      return undefined;
    }

    return this.update(existing.id, {
      healthStatus,
      lastHealthCheck,
    });
  }

  /**
   * Update circuit breaker state
   */
  async updateCircuitState(
    provider: BookSource,
    circuitState: ProviderConfig["circuitState"],
    failureCount?: number,
    lastFailure?: Date
  ): Promise<ProviderConfig | undefined> {
    const existing = await this.findByProvider(provider);
    if (!existing) {
      return undefined;
    }

    return this.update(existing.id, {
      circuitState,
      failureCount: failureCount ?? existing.failureCount,
      lastFailure: lastFailure ?? existing.lastFailure,
    });
  }

  /**
   * Reset circuit breaker failure count
   */
  async resetFailureCount(provider: BookSource): Promise<ProviderConfig | undefined> {
    const existing = await this.findByProvider(provider);
    if (!existing) {
      return undefined;
    }

    return this.update(existing.id, {
      failureCount: 0,
      lastFailure: null,
    } as Partial<NewProviderConfig>);
  }

  /**
   * Update provider settings
   */
  async updateSettings(
    provider: BookSource,
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
    provider: BookSource,
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
