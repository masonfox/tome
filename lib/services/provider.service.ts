/**
 * Provider Service
 * 
 * Orchestration layer for metadata providers. Manages provider operations
 * with timeout handling and error tracking.
 */

import { getLogger } from "@/lib/logger";
import { getProvider, getAllProviders } from "@/lib/providers/provider-map";
import { providerConfigRepository } from "@/lib/repositories/provider-config.repository";
import type {
  IMetadataProvider,
  ProviderId,
  SearchResult,
  BookMetadata,
  SyncResult,
} from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "provider-service" });

/**
 * Provider operation error
 */
export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderId,
    public readonly operation: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(`Provider '${provider}' ${operation} failed: ${message}`);
    this.name = "ProviderError";
  }
}

/**
 * Provider Service
 * 
 * Orchestrates metadata provider operations with error handling and logging.
 * 
 * @example
 * ```typescript
 * // Search across all enabled providers
 * const results = await providerService.search('hardcover', 'The Great Gatsby');
 * 
 * // Fetch metadata
 * const metadata = await providerService.fetchMetadata('hardcover', 'abc123');
 * 
 * // Get enabled search providers
 * const searchProviders = await providerService.getProvidersByCapability('hasSearch');
 * ```
 */
export class ProviderService {
  /**
   * Get provider by ID
   * 
   * @throws Error if provider not found
   */
  getProvider(source: ProviderId): IMetadataProvider {
    const provider = getProvider(source);
    if (!provider) {
      throw new Error(`Provider '${source}' not found`);
    }
    return provider;
  }

  /**
   * Get all enabled providers sorted by priority
   * 
   * Queries database for enabled state and priority, then returns
   * provider instances sorted by priority.
   */
  async getEnabledProviders(): Promise<IMetadataProvider[]> {
    const allProviders = getAllProviders();
    
    // Query database for each provider's config
    const configs = await Promise.all(
      allProviders.map(async (provider) => {
        const config = await providerConfigRepository.findByProvider(provider.id);
        return {
          provider,
          enabled: config?.enabled ?? true,
          priority: config?.priority ?? 100,
        };
      })
    );

    // Filter enabled and sort by priority (lower = higher priority)
    return configs
      .filter((c) => c.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map((c) => c.provider);
  }

  /**
   * Get providers with specific capability
   * 
   * Returns enabled providers that support the specified capability,
   * sorted by priority.
   */
  async getProvidersByCapability(
    capability: keyof IMetadataProvider["capabilities"]
  ): Promise<IMetadataProvider[]> {
    const enabled = await this.getEnabledProviders();
    return enabled.filter((provider) => provider.capabilities[capability]);
  }

  /**
   * Search for books using a specific provider
   * 
   * @throws ProviderError if search fails
   */
  async search(source: ProviderId, query: string): Promise<SearchResult[]> {
    const provider = this.getProvider(source);

    // Validate capability
    if (!provider.capabilities.hasSearch) {
      throw new ProviderError(
        source,
        "search",
        "Provider does not support search"
      );
    }

    // Execute search
    try {
      logger.debug({ provider: source, query }, "Executing provider search");
      const results = await provider.search!(query);
      logger.info(
        { provider: source, query, resultCount: results.length },
        "Provider search succeeded"
      );
      return results;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        { provider: source, query, error: err.message },
        "Provider search failed"
      );
      throw new ProviderError(source, "search", err.message, err);
    }
  }

  /**
   * Fetch full metadata using a specific provider
   * 
   * @throws ProviderError if fetch fails
   */
  async fetchMetadata(
    source: ProviderId,
    externalId: string
  ): Promise<BookMetadata> {
    const provider = this.getProvider(source);

    // Validate capability
    if (!provider.capabilities.hasMetadataFetch) {
      throw new ProviderError(
        source,
        "fetchMetadata",
        "Provider does not support metadata fetch"
      );
    }

    // Execute fetch
    try {
      logger.debug(
        { provider: source, externalId },
        "Executing provider metadata fetch"
      );
      const metadata = await provider.fetchMetadata!(externalId);
      logger.info(
        { provider: source, externalId, title: metadata.title },
        "Provider metadata fetch succeeded"
      );
      return metadata;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        { provider: source, externalId, error: err.message },
        "Provider metadata fetch failed"
      );
      throw new ProviderError(source, "fetchMetadata", err.message, err);
    }
  }

  /**
   * Sync entire library using a specific provider
   * 
   * @throws ProviderError if sync fails
   */
  async sync(source: ProviderId): Promise<SyncResult> {
    const provider = this.getProvider(source);

    // Validate capability
    if (!provider.capabilities.hasSync) {
      throw new ProviderError(
        source,
        "sync",
        "Provider does not support sync"
      );
    }

    // Execute sync
    try {
      logger.info({ provider: source }, "Starting provider sync");
      const result = await provider.sync!();
      logger.info(
        { provider: source, result },
        "Provider sync completed successfully"
      );
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        { provider: source, error: err.message },
        "Provider sync failed"
      );
      throw new ProviderError(source, "sync", err.message, err);
    }
  }

  /**
   * Enable or disable a provider
   * 
   * Updates database only. No in-memory state.
   */
  async setEnabled(source: ProviderId, enabled: boolean): Promise<void> {
    await providerConfigRepository.setEnabled(source, enabled);
    logger.info({ provider: source, enabled }, "Updated provider enabled state");
  }
}

// Export singleton instance
export const providerService = new ProviderService();
