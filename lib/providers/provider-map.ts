/**
 * Provider Map
 * 
 * Simple registry of all available metadata providers.
 * Replaces the complex ProviderRegistry with a lightweight lookup mechanism.
 */

import { calibreProvider } from "./calibre.provider";
import { hardcoverProvider } from "./hardcover.provider";
import { openLibraryProvider } from "./openlibrary.provider";
import type { IMetadataProvider, ProviderId } from "./base/IMetadataProvider";

/**
 * Map of all available providers
 * 
 * Providers are registered here at module initialization.
 * Configuration (enabled, priority) comes from database.
 * 
 * Note: Only include providers that actually exist.
 * audiobookshelf is defined in ProviderId type for future use but not yet implemented.
 */
export const PROVIDER_MAP: Partial<Record<ProviderId, IMetadataProvider>> = {
  calibre: calibreProvider,
  hardcover: hardcoverProvider,
  openlibrary: openLibraryProvider,
};

/**
 * Get provider by ID
 * 
 * @param id - Provider identifier
 * @returns Provider instance or undefined if not found
 */
export function getProvider(id: ProviderId): IMetadataProvider | undefined {
  return PROVIDER_MAP[id];
}

/**
 * Get all registered providers
 * 
 * @returns Array of all provider instances
 */
export function getAllProviders(): IMetadataProvider[] {
  return Object.values(PROVIDER_MAP);
}

/**
 * Check if provider exists
 * 
 * @param id - Provider identifier
 * @returns True if provider is registered
 */
export function hasProvider(id: ProviderId): boolean {
  return id in PROVIDER_MAP;
}
