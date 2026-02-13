/**
 * Manual Provider
 * 
 * Provider for manually-entered books (no external metadata source).
 * Always enabled, no authentication, no external API calls.
 * 
 * This provider exists primarily for consistency in the provider architecture,
 * even though it doesn't fetch external metadata.
 */

import type {
  IMetadataProvider,
  ProviderCapabilities,
  ProviderHealth,
  ProviderId,
} from "./base/IMetadataProvider";

export class ManualProvider implements IMetadataProvider {
  readonly id: ProviderId = "manual";
  readonly name: string = "Manual Entry";
  readonly capabilities: ProviderCapabilities = {
    hasSearch: false,
    hasMetadataFetch: false,
    hasSync: false,
    requiresAuth: false,
  };

  /**
   * Health check always returns healthy (no external dependency)
   */
  async healthCheck(): Promise<ProviderHealth> {
    return "healthy";
  }
}

// Export singleton instance
export const manualProvider = new ManualProvider();
