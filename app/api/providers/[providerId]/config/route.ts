/**
 * PATCH /api/providers/[providerId]/config - Update provider configuration
 * 
 * Updates provider settings, credentials, and enabled state.
 * 
 * @param {string} providerId - Provider identifier (calibre, manual, hardcover, openlibrary)
 * @body {Object} config - Configuration updates
 * @body {boolean} [config.enabled] - Enable/disable provider
 * @body {Object} [config.settings] - Provider-specific settings (timeout, etc.)
 * @body {Object} [config.credentials] - Provider credentials (API keys)
 * 
 * @returns {Provider} Updated provider configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";
import { ProviderRegistry, initializeProviders } from "@/lib/providers/base/ProviderRegistry";
import { providerConfigRepository } from "@/lib/repositories/provider-config.repository";
import { providerService } from "@/lib/services/provider.service";
import type { ProviderId } from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "api-provider-config" });

export const dynamic = "force-dynamic";

// Validation schema for configuration updates
interface ConfigUpdate {
  enabled?: boolean;
  settings?: Record<string, unknown>;
  credentials?: Record<string, string>;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const { providerId } = await params;
    
    // Ensure providers are initialized
    if (!ProviderRegistry.isInitialized()) {
      initializeProviders();
    }
    
    // Validate provider exists
    if (!ProviderRegistry.has(providerId as ProviderId)) {
      return NextResponse.json(
        {
          error: "Provider not found",
          message: `Provider '${providerId}' does not exist`,
        },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json() as ConfigUpdate;
    
    // Validate request
    if (!body.enabled && !body.settings && !body.credentials) {
      return NextResponse.json(
        {
          error: "Invalid request",
          message: "At least one of enabled, settings, or credentials must be provided",
        },
        { status: 400 }
      );
    }

    logger.info(
      { 
        providerId, 
        hasEnabled: body.enabled !== undefined,
        hasSettings: !!body.settings,
        hasCredentials: !!body.credentials,
      },
      "Updating provider configuration"
    );

    // Get existing config
    const existingConfig = await providerConfigRepository.findByProvider(
      providerId as ProviderId
    );

    if (!existingConfig) {
      return NextResponse.json(
        {
          error: "Provider configuration not found",
          message: `No configuration found for provider '${providerId}'`,
        },
        { status: 404 }
      );
    }

    // Update enabled state (if provided)
    if (body.enabled !== undefined) {
      await providerService.setEnabled(providerId as ProviderId, body.enabled);
      logger.info({ providerId, enabled: body.enabled }, "Updated provider enabled state");
    }

    // Update settings (if provided)
    if (body.settings) {
      await providerConfigRepository.updateSettings(
        providerId as ProviderId,
        body.settings
      );
      logger.info({ providerId, settings: body.settings }, "Updated provider settings");
    }

    // Update credentials (if provided)
    if (body.credentials) {
      await providerConfigRepository.updateCredentials(
        providerId as ProviderId,
        body.credentials
      );
      logger.info({ providerId }, "Updated provider credentials (redacted)");
    }

    // Fetch updated configuration
    const updatedConfig = await providerConfigRepository.findByProvider(
      providerId as ProviderId
    );
    const registryEntry = ProviderRegistry.getEntry(providerId as ProviderId);

    // Return updated configuration (without sensitive credentials)
    return NextResponse.json({
      id: providerId,
      name: registryEntry?.provider.name,
      capabilities: registryEntry?.provider.capabilities,
      enabled: registryEntry?.enabled ?? true,
      priority: registryEntry?.priority ?? 100,
      healthStatus: registryEntry?.healthStatus ?? "healthy",
      settings: updatedConfig?.settings || {},
      hasCredentials: !!(updatedConfig?.credentials && Object.keys(updatedConfig.credentials).length > 0),
      updatedAt: updatedConfig?.updatedAt?.toISOString(),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const { providerId } = await params;
    logger.error({ error: err.message, providerId }, "Failed to update provider configuration");

    return NextResponse.json(
      {
        error: "Failed to update provider configuration",
        message: err.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/providers/[providerId]/config - Get provider configuration
 * 
 * Returns detailed configuration for a specific provider.
 * 
 * @param {string} providerId - Provider identifier
 * @returns {Provider} Provider configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const { providerId } = await params;
    
    // Ensure providers are initialized
    if (!ProviderRegistry.isInitialized()) {
      initializeProviders();
    }
    
    // Validate provider exists
    if (!ProviderRegistry.has(providerId as ProviderId)) {
      return NextResponse.json(
        {
          error: "Provider not found",
          message: `Provider '${providerId}' does not exist`,
        },
        { status: 404 }
      );
    }

    const config = await providerConfigRepository.findByProvider(
      providerId as ProviderId
    );
    const registryEntry = ProviderRegistry.getEntry(providerId as ProviderId);
    const circuitStats = await providerService.getCircuitStats(
      providerId as ProviderId
    );

    if (!config) {
      return NextResponse.json(
        {
          error: "Provider configuration not found",
          message: `No configuration found for provider '${providerId}'`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: providerId,
      name: registryEntry?.provider.name,
      capabilities: registryEntry?.provider.capabilities,
      enabled: registryEntry?.enabled ?? true,
      priority: registryEntry?.priority ?? 100,
      healthStatus: registryEntry?.healthStatus ?? "healthy",
      lastHealthCheck: registryEntry?.lastHealthCheck?.toISOString(),
      circuitState: circuitStats.state,
      failureCount: circuitStats.failureCount,
      lastFailure: circuitStats.lastFailure?.toISOString(),
      settings: config.settings || {},
      hasCredentials: !!(config.credentials && Object.keys(config.credentials).length > 0),
      createdAt: config.createdAt?.toISOString(),
      updatedAt: config.updatedAt?.toISOString(),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const { providerId } = await params;
    logger.error({ error: err.message, providerId }, "Failed to get provider configuration");

    return NextResponse.json(
      {
        error: "Failed to get provider configuration",
        message: err.message,
      },
      { status: 500 }
    );
  }
}
