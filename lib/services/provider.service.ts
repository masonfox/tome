/**
 * Provider Service
 * 
 * Orchestration layer for metadata providers. Wraps provider operations with
 * circuit breaker protection, health checks, and error handling.
 * 
 * See: specs/003-non-calibre-books/research.md (Decision 4: Circuit Breaker)
 */

import { getLogger } from "@/lib/logger";
import { ProviderRegistry } from "@/lib/providers/base/ProviderRegistry";
import { circuitBreakerService } from "@/lib/services/circuit-breaker.service";
import { providerConfigRepository } from "@/lib/repositories/provider-config.repository";
import type {
  IMetadataProvider,
  ProviderId,
  SearchResult,
  BookMetadata,
  SyncResult,
  ProviderHealth,
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
 * Circuit open error (provider unavailable)
 */
export class CircuitOpenError extends ProviderError {
  constructor(provider: ProviderId, operation: string) {
    super(
      provider,
      operation,
      "Circuit breaker is OPEN - provider unavailable"
    );
    this.name = "CircuitOpenError";
  }
}

/**
 * Provider Service
 * 
 * Orchestrates metadata provider operations with circuit breaker protection,
 * health monitoring, and automatic failover.
 * 
 * @example
 * ```typescript
 * // Search across all enabled providers
 * const results = await providerService.search('calibre', 'The Great Gatsby');
 * 
 * // Fetch metadata with circuit breaker protection
 * const metadata = await providerService.fetchMetadata('hardcover', 'abc123');
 * 
 * // Run health checks
 * await providerService.healthCheckAll();
 * ```
 */
export class ProviderService {
  /**
   * Get provider by ID
   * 
   * @throws Error if provider not found
   */
  getProvider(source: ProviderId): IMetadataProvider {
    const provider = ProviderRegistry.get(source);
    if (!provider) {
      throw new Error(`Provider '${source}' not found`);
    }
    return provider;
  }

  /**
   * Get all enabled providers sorted by priority
   */
  getEnabledProviders(): IMetadataProvider[] {
    return ProviderRegistry.getEnabled();
  }

  /**
   * Get providers with specific capability
   */
  getProvidersByCapability(
    capability: keyof IMetadataProvider["capabilities"]
  ): IMetadataProvider[] {
    return ProviderRegistry.getByCapability(capability);
  }

  /**
   * Search for books using a specific provider
   * 
   * @throws CircuitOpenError if circuit breaker is open
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

    // Check circuit breaker
    const canProceed = await circuitBreakerService.canProceed(source);
    if (!canProceed) {
      throw new CircuitOpenError(source, "search");
    }

    // Execute search with circuit breaker tracking
    try {
      logger.debug({ provider: source, query }, "Executing provider search");
      const results = await provider.search!(query);
      await circuitBreakerService.recordSuccess(source);
      logger.info(
        { provider: source, query, resultCount: results.length },
        "Provider search succeeded"
      );
      return results;
    } catch (error) {
      await circuitBreakerService.recordFailure(source);
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
   * @throws CircuitOpenError if circuit breaker is open
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

    // Check circuit breaker
    const canProceed = await circuitBreakerService.canProceed(source);
    if (!canProceed) {
      throw new CircuitOpenError(source, "fetchMetadata");
    }

    // Execute fetch with circuit breaker tracking
    try {
      logger.debug(
        { provider: source, externalId },
        "Executing provider metadata fetch"
      );
      const metadata = await provider.fetchMetadata!(externalId);
      await circuitBreakerService.recordSuccess(source);
      logger.info(
        { provider: source, externalId, title: metadata.title },
        "Provider metadata fetch succeeded"
      );
      return metadata;
    } catch (error) {
      await circuitBreakerService.recordFailure(source);
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
   * @throws CircuitOpenError if circuit breaker is open
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

    // Check circuit breaker
    const canProceed = await circuitBreakerService.canProceed(source);
    if (!canProceed) {
      throw new CircuitOpenError(source, "sync");
    }

    // Execute sync with circuit breaker tracking
    try {
      logger.info({ provider: source }, "Starting provider sync");
      const result = await provider.sync!();
      await circuitBreakerService.recordSuccess(source);
      logger.info(
        { provider: source, result },
        "Provider sync completed successfully"
      );
      return result;
    } catch (error) {
      await circuitBreakerService.recordFailure(source);
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        { provider: source, error: err.message },
        "Provider sync failed"
      );
      throw new ProviderError(source, "sync", err.message, err);
    }
  }

  /**
   * Run health check on a specific provider
   * 
   * Updates provider health status in database.
   * 
   * @returns Current health status
   */
  async healthCheck(source: ProviderId): Promise<ProviderHealth> {
    const provider = this.getProvider(source);

    try {
      logger.debug({ provider: source }, "Running provider health check");
      const status = await provider.healthCheck();
      
      // Update database
      await providerConfigRepository.updateHealth(source, status, new Date());
      
      // Update registry
      ProviderRegistry.updateHealth(source, status);

      logger.debug(
        { provider: source, status },
        "Provider health check completed"
      );
      return status;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        { provider: source, error: err.message },
        "Provider health check failed"
      );
      
      // Mark as unavailable
      await providerConfigRepository.updateHealth(
        source,
        "unavailable",
        new Date()
      );
      ProviderRegistry.updateHealth(source, "unavailable");
      
      return "unavailable";
    }
  }

  /**
   * Run health checks on all registered providers
   * 
   * @returns Map of provider ID to health status
   */
  async healthCheckAll(): Promise<Map<ProviderId, ProviderHealth>> {
    const providers = ProviderRegistry.getAll();
    const results = new Map<ProviderId, ProviderHealth>();

    logger.info(
      { providerCount: providers.length },
      "Running health checks on all providers"
    );

    // Run all health checks in parallel
    await Promise.all(
      providers.map(async (provider) => {
        const status = await this.healthCheck(provider.id);
        results.set(provider.id, status);
      })
    );

    const healthySummary = Array.from(results.entries()).reduce(
      (acc, [id, status]) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<ProviderHealth, number>
    );

    logger.info(
      { results: healthySummary },
      "Completed health checks on all providers"
    );

    return results;
  }

  /**
   * Enable or disable a provider at runtime
   * 
   * Updates both database and registry.
   */
  async setEnabled(source: ProviderId, enabled: boolean): Promise<void> {
    await providerConfigRepository.setEnabled(source, enabled);
    ProviderRegistry.setEnabled(source, enabled);
    logger.info({ provider: source, enabled }, "Updated provider enabled state");
  }

  /**
   * Get circuit breaker statistics for a provider
   */
  async getCircuitStats(source: ProviderId) {
    return circuitBreakerService.getStats(source);
  }

  /**
   * Manually reset circuit breaker for a provider
   * 
   * Use when you know the provider is healthy again.
   */
  async resetCircuit(source: ProviderId): Promise<void> {
    await circuitBreakerService.reset(source);
    logger.info({ provider: source }, "Circuit breaker manually reset");
  }
}

// Export singleton instance
export const providerService = new ProviderService();
