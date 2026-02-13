/**
 * Provider Registry
 * 
 * Central registry for all metadata providers. Handles provider discovery,
 * validation, and lookup operations.
 * 
 * See: specs/003-non-calibre-books/research.md (Decision 1: Provider Interface)
 */

import { getLogger } from "@/lib/logger";
import type {
  IMetadataProvider,
  ProviderRegistryEntry,
  ProviderId,
  ProviderHealth,
} from "./IMetadataProvider";

const logger = getLogger().child({ module: "provider-registry" });

/**
 * Provider Registry
 * 
 * Singleton registry for managing metadata providers. Validates provider
 * implementations and provides lookup/discovery operations.
 * 
 * @example
 * ```typescript
 * // Register provider
 * ProviderRegistry.register(calibreProvider);
 * 
 * // Get provider
 * const provider = ProviderRegistry.get('calibre');
 * 
 * // Get enabled providers sorted by priority
 * const providers = ProviderRegistry.getEnabled();
 * ```
 */
export class ProviderRegistry {
  private static providers = new Map<ProviderId, ProviderRegistryEntry>();
  private static initialized = false;

  /**
   * Register a metadata provider
   * 
   * Validates provider implementation against declared capabilities.
   * 
   * @param provider - Provider instance to register
   * @param options - Registration options
   * @throws Error if provider invalid or already registered
   */
  static register(
    provider: IMetadataProvider,
    options: {
      enabled?: boolean;
      priority?: number;
    } = {}
  ): void {
    const { enabled = true, priority = 100 } = options;

    // Validate provider
    this.validateProvider(provider);

    // Check for duplicates
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider '${provider.id}' already registered`);
    }

    // Register provider
    this.providers.set(provider.id, {
      provider,
      enabled,
      priority,
      healthStatus: "healthy",
    });

    logger.info(
      {
        providerId: provider.id,
        capabilities: provider.capabilities,
        enabled,
        priority,
      },
      "Registered provider"
    );
  }

  /**
   * Validate provider implementation
   * 
   * Ensures provider implements methods corresponding to declared capabilities.
   * 
   * @internal
   */
  private static validateProvider(provider: IMetadataProvider): void {
    // Check required fields
    if (!provider.id || !provider.name || !provider.capabilities) {
      throw new Error(
        `Provider missing required fields: id, name, capabilities`
      );
    }

    // Validate healthCheck exists
    if (typeof provider.healthCheck !== "function") {
      throw new Error(
        `Provider '${provider.id}' must implement healthCheck method`
      );
    }

    // Validate capability methods
    const { capabilities } = provider;

    if (capabilities.hasSearch && typeof provider.search !== "function") {
      throw new Error(
        `Provider '${provider.id}' declares hasSearch but search method not implemented`
      );
    }

    if (
      capabilities.hasMetadataFetch &&
      typeof provider.fetchMetadata !== "function"
    ) {
      throw new Error(
        `Provider '${provider.id}' declares hasMetadataFetch but fetchMetadata method not implemented`
      );
    }

    if (capabilities.hasSync && typeof provider.sync !== "function") {
      throw new Error(
        `Provider '${provider.id}' declares hasSync but sync method not implemented`
      );
    }
  }

  /**
   * Get provider by ID
   * 
   * @param id - Provider identifier
   * @returns Provider instance or undefined
   */
  static get(id: ProviderId): IMetadataProvider | undefined {
    return this.providers.get(id)?.provider;
  }

  /**
   * Get provider entry (includes runtime state)
   * 
   * @internal
   */
  static getEntry(id: ProviderId): ProviderRegistryEntry | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers
   * 
   * @returns Array of all providers (unsorted)
   */
  static getAll(): IMetadataProvider[] {
    return Array.from(this.providers.values()).map((entry) => entry.provider);
  }

  /**
   * Get enabled providers sorted by priority
   * 
   * @returns Array of enabled providers (ascending priority)
   */
  static getEnabled(): IMetadataProvider[] {
    return Array.from(this.providers.values())
      .filter((entry) => entry.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map((entry) => entry.provider);
  }

  /**
   * Get providers with specific capability
   * 
   * @param capability - Capability name to filter by
   * @returns Array of providers with capability (sorted by priority)
   */
  static getByCapability(
    capability: keyof IMetadataProvider["capabilities"]
  ): IMetadataProvider[] {
    return this.getEnabled().filter(
      (provider) => provider.capabilities[capability]
    );
  }

  /**
   * Update provider health status
   * 
   * @param id - Provider identifier
   * @param status - New health status
   */
  static updateHealth(id: ProviderId, status: ProviderHealth): void {
    const entry = this.providers.get(id);
    if (entry) {
      entry.healthStatus = status;
      entry.lastHealthCheck = new Date();
      logger.debug({ providerId: id, status }, "Updated provider health");
    }
  }

  /**
   * Enable/disable provider at runtime
   * 
   * @param id - Provider identifier
   * @param enabled - Enable state
   */
  static setEnabled(id: ProviderId, enabled: boolean): void {
    const entry = this.providers.get(id);
    if (entry) {
      entry.enabled = enabled;
      logger.info({ providerId: id, enabled }, "Updated provider enabled state");
    }
  }

  /**
   * Update provider priority
   * 
   * @param id - Provider identifier
   * @param priority - New priority value (lower = higher priority)
   */
  static setPriority(id: ProviderId, priority: number): void {
    const entry = this.providers.get(id);
    if (entry) {
      entry.priority = priority;
      logger.info({ providerId: id, priority }, "Updated provider priority");
    }
  }

  /**
   * Check if provider exists
   * 
   * @param id - Provider identifier
   * @returns True if provider registered
   */
  static has(id: ProviderId): boolean {
    return this.providers.has(id);
  }

  /**
   * Unregister provider (primarily for testing)
   * 
   * @param id - Provider identifier
   * @internal
   */
  static unregister(id: ProviderId): void {
    this.providers.delete(id);
    logger.debug({ providerId: id }, "Unregistered provider");
  }

  /**
   * Clear all providers (primarily for testing)
   * 
   * @internal
   */
  static clear(): void {
    this.providers.clear();
    this.initialized = false;
    logger.debug("Cleared provider registry");
  }

  /**
   * Mark registry as initialized
   * 
   * Used to prevent re-initialization in production.
   * 
   * @internal
   */
  static markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Check if registry is initialized
   * 
   * @returns True if initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Initialize all providers
 * 
 * Registers all available metadata providers with their default configurations.
 * Should be called once at application startup.
 * 
 * @example
 * ```typescript
 * // In app initialization
 * initializeProviders();
 * ```
 */
export function initializeProviders(): void {
  // Skip if already initialized (prevent duplicate registration)
  if (ProviderRegistry.isInitialized()) {
    logger.debug("Provider registry already initialized - skipping");
    return;
  }

  // Import providers lazily to avoid circular dependencies
  const { calibreProvider } = require("@/lib/providers/calibre.provider");
  const { manualProvider } = require("@/lib/providers/manual.provider");
  const { hardcoverProvider } = require("@/lib/providers/hardcover.provider");
  const { openLibraryProvider } = require("@/lib/providers/openlibrary.provider");

  // Register providers with priorities matching database seed data
  // Priority: lower = higher priority (Calibre=1, Hardcover=10, OpenLibrary=20, Manual=99)
  
  ProviderRegistry.register(calibreProvider, {
    enabled: true,
    priority: 1, // Highest priority - primary source
  });

  ProviderRegistry.register(manualProvider, {
    enabled: true,
    priority: 99, // Lowest priority - fallback for user-entered books
  });

  ProviderRegistry.register(hardcoverProvider, {
    enabled: true,
    priority: 10, // Medium-high priority
  });

  ProviderRegistry.register(openLibraryProvider, {
    enabled: true,
    priority: 20, // Medium priority
  });

  // Mark as initialized to prevent re-registration
  ProviderRegistry.markInitialized();

  logger.info(
    {
      providers: ["calibre", "manual", "hardcover", "openlibrary"],
      count: 4,
    },
    "Provider registry initialized with 4 providers"
  );
}
