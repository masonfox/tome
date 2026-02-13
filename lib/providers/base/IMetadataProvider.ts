/**
 * Metadata Provider Interface
 * 
 * Defines the contract for all book metadata providers (Calibre, manual entry,
 * external APIs like Hardcover and OpenLibrary).
 * 
 * Providers declare capabilities via boolean flags and implement only the
 * methods corresponding to their capabilities.
 */

/**
 * Provider health status
 * 
 * Tracks provider availability for circuit breaker pattern:
 * - healthy: Provider responding normally
 * - unavailable: Provider failing (circuit open)
 */
export type ProviderHealth = "healthy" | "unavailable";

/**
 * Provider identifier
 * 
 * Identifies a metadata provider in the provider infrastructure.
 * Used for provider registration, registry lookups, and configuration.
 * 
 * - calibre: Calibre library integration (sync provider)
 * - manual: Manual entry (no external API)
 * - hardcover: Hardcover.app API (metadata search provider)
 * - openlibrary: OpenLibrary.org API (metadata search provider)
 */
export type ProviderId = "calibre" | "manual" | "hardcover" | "openlibrary";

/**
 * Book source identifier
 * 
 * Indicates where a book record is owned/managed. Stored on the book record.
 * 
 * - calibre: Synced from Calibre library database
 * - manual: User-created (via manual entry form OR via federated search)
 * 
 * Note: Hardcover and OpenLibrary are metadata providers, not sources.
 * Books added via provider search always get source='manual'.
 */
export type BookSource = "calibre" | "manual";

/**
 * Provider capabilities
 * 
 * Boolean flags indicating which operations a provider supports.
 * Used for runtime validation and UI feature toggling.
 */
export interface ProviderCapabilities {
  /** Can search for books by query string */
  hasSearch: boolean;
  
  /** Can fetch full metadata by external ID */
  hasMetadataFetch: boolean;
  
  /** Can sync entire library (batch import) */
  hasSync: boolean;
  
  /** Requires authentication credentials (API key, etc.) */
  requiresAuth: boolean;
}

/**
 * Book metadata structure
 * 
 * Normalized metadata format returned by all providers.
 * Maps to the books table schema.
 */
export interface BookMetadata {
  // Core metadata
  title: string;
  authors: string[];
  isbn?: string;
  description?: string;
  
  // Publication details
  publisher?: string;
  pubDate?: Date;
  totalPages?: number;
  
  // Series information
  series?: string;
  seriesIndex?: number;
  
  // External identifiers
  externalId?: string;  // Provider-specific ID
  
  // Additional metadata
  tags?: string[];
  coverImageUrl?: string;
  rating?: number;  // 1-5 stars
}

/**
 * Search result item
 * 
 * Lightweight search result with essential metadata for selection UI.
 */
export interface SearchResult {
  externalId: string;
  title: string;
  authors: string[];
  isbn?: string;
  coverImageUrl?: string;
  publisher?: string;
  pubDate?: Date;
  totalPages?: number;
}

/**
 * Sync operation result
 * 
 * Statistics from batch library synchronization.
 */
export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: number;
}

/**
 * Metadata Provider Interface
 * 
 * Core interface for all book metadata providers. Providers implement
 * only the methods corresponding to their declared capabilities.
 * 
 * @example
 * ```typescript
 * class ManualProvider implements IMetadataProvider {
 *   id = 'manual';
 *   name = 'Manual Entry';
 *   capabilities = {
 *     hasSearch: false,
 *     hasMetadataFetch: false,
 *     hasSync: false,
 *     requiresAuth: false,
 *   };
 *   
 *   async healthCheck() {
 *     return 'healthy' as const;
 *   }
 * }
 * ```
 */
export interface IMetadataProvider {
  /** Unique provider identifier */
  readonly id: ProviderId;
  
  /** Human-readable display name */
  readonly name: string;
  
  /** Provider capabilities declaration */
  readonly capabilities: ProviderCapabilities;
  
  /**
   * Search for books by query
   * 
   * Only implement if capabilities.hasSearch = true
   * 
   * @param query - Search query string (title, author, ISBN, etc.)
   * @returns Array of search results
   * @throws Error if provider unavailable or API error
   */
  search?(query: string): Promise<SearchResult[]>;
  
  /**
   * Fetch full metadata by external ID
   * 
   * Only implement if capabilities.hasMetadataFetch = true
   * 
   * @param externalId - Provider-specific book identifier
   * @returns Complete book metadata
   * @throws Error if book not found or provider unavailable
   */
  fetchMetadata?(externalId: string): Promise<BookMetadata>;
  
  /**
   * Sync entire library (batch import)
   * 
   * Only implement if capabilities.hasSync = true
   * 
   * @returns Sync statistics
   * @throws Error if sync fails
   */
  sync?(): Promise<SyncResult>;
  
  /**
   * Check provider health
   * 
   * Must be implemented by all providers. Used for circuit breaker pattern
   * to detect and isolate failing providers.
   * 
   * @returns Current health status
   */
  healthCheck(): Promise<ProviderHealth>;
}

/**
 * Provider registry entry
 * 
 * Internal type for provider registry with runtime state.
 */
export interface ProviderRegistryEntry {
  provider: IMetadataProvider;
  enabled: boolean;
  priority: number;
  lastHealthCheck?: Date;
  healthStatus: ProviderHealth;
}
