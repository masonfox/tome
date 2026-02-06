/**
 * GET /api/providers - List all providers
 * 
 * Returns all registered metadata providers with their configuration,
 * capabilities, health status, and circuit breaker state.
 * 
 * @returns {Provider[]} Array of provider configurations
 */

import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";
import { ProviderRegistry, initializeProviders } from "@/lib/providers/base/ProviderRegistry";
import { providerConfigRepository } from "@/lib/repositories/provider-config.repository";
import { circuitBreakerService } from "@/lib/services/circuit-breaker.service";
import type { BookSource } from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "api-providers" });

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Ensure providers are initialized
    if (!ProviderRegistry.isInitialized()) {
      initializeProviders();
    }

    // Get all registered providers
    const providers = ProviderRegistry.getAll();

    // Fetch database configurations
    const dbConfigs = await Promise.all(
      providers.map(async (provider) => {
        const config = await providerConfigRepository.findByProvider(
          provider.id as BookSource
        );
        const circuitStats = await circuitBreakerService.getStats(
          provider.id as BookSource
        );
        const registryEntry = ProviderRegistry.getEntry(
          provider.id as BookSource
        );

        return {
          id: provider.id,
          name: provider.name,
          capabilities: provider.capabilities,
          enabled: registryEntry?.enabled ?? true,
          priority: registryEntry?.priority ?? 100,
          healthStatus: registryEntry?.healthStatus ?? "healthy",
          lastHealthCheck: registryEntry?.lastHealthCheck?.toISOString(),
          circuitState: circuitStats.state,
          failureCount: circuitStats.failureCount,
          lastFailure: circuitStats.lastFailure?.toISOString(),
          settings: config?.settings || {},
          hasCredentials: !!(config?.credentials && Object.keys(config.credentials).length > 0),
        };
      })
    );

    logger.debug({ count: dbConfigs.length }, "Retrieved provider list");

    return NextResponse.json({
      providers: dbConfigs,
      count: dbConfigs.length,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ error: err.message }, "Failed to list providers");

    return NextResponse.json(
      {
        error: "Failed to list providers",
        message: err.message,
      },
      { status: 500 }
    );
  }
}
