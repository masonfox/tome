/**
 * GET /api/providers - List all providers
 * 
 * Returns all registered metadata providers with their configuration
 * and capabilities.
 * 
 * @returns {Provider[]} Array of provider configurations
 */

import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";
import { getAllProviders } from "@/lib/providers/provider-map";
import { providerConfigRepository } from "@/lib/repositories/provider-config.repository";
import type { ProviderId } from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "api-providers" });

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get all registered providers
    const providers = getAllProviders();

    // Fetch database configurations
    const dbConfigs = await Promise.all(
      providers.map(async (provider) => {
        const config = await providerConfigRepository.findByProvider(
          provider.id as ProviderId
        );

        return {
          id: provider.id,
          name: provider.name,
          capabilities: provider.capabilities,
          enabled: config?.enabled ?? true,
          priority: config?.priority ?? 100,
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
