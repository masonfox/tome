/**
 * Companion Migration: Seed Default Provider Configurations
 * 
 * This migration seeds the provider_configs table with default configurations
 * for all supported metadata providers:
 * - calibre: Existing Calibre library sync
 * - manual: User-entered books without external source
 * - hardcover: Hardcover.app API integration
 * - openlibrary: OpenLibrary.org API integration
 * 
 * Runs only on existing databases (skipped on fresh installations where
 * provider_configs will be empty).
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0022_seed_provider_configs" });

const migration: CompanionMigration = {
  name: "0022_seed_provider_configs",
  
  // Only run if provider_configs table exists
  requiredTables: ["provider_configs"],
  
  description: "Seed default provider configurations for multi-source book tracking",
  
  async execute(db) {
    logger.info("Seeding default provider configurations...");
    
    // Check if providers already exist (idempotent)
    const existing = db.prepare(
      "SELECT COUNT(*) as count FROM provider_configs"
    ).get() as { count: number };
    
    if (existing.count > 0) {
      logger.info({ count: existing.count }, "Provider configs already exist, skipping seed");
      return;
    }
    
    // Default provider configurations
    const providers = [
      {
        provider: "calibre",
        display_name: "Calibre Library",
        enabled: 1,
        capabilities: JSON.stringify({
          hasSearch: false,
          hasMetadataFetch: true,
          hasSync: true,
          requiresAuth: false,
        }),
        settings: JSON.stringify({}),
        credentials: JSON.stringify({}),
        circuit_state: "CLOSED",
        failure_count: 0,
        health_status: "healthy",
        priority: 1, // Highest priority
      },
      {
        provider: "manual",
        display_name: "Manual Entry",
        enabled: 1,
        capabilities: JSON.stringify({
          hasSearch: false,
          hasMetadataFetch: false,
          hasSync: false,
          requiresAuth: false,
        }),
        settings: JSON.stringify({}),
        credentials: JSON.stringify({}),
        circuit_state: "CLOSED",
        failure_count: 0,
        health_status: "healthy",
        priority: 99, // Lowest priority (fallback)
      },
      {
        provider: "hardcover",
        display_name: "Hardcover",
        enabled: 1,
        capabilities: JSON.stringify({
          hasSearch: true,
          hasMetadataFetch: true,
          hasSync: false,
          requiresAuth: true,
        }),
        settings: JSON.stringify({
          baseUrl: "https://hardcover.app/api/v1",
          timeout: 5000,
        }),
        credentials: JSON.stringify({}),
        circuit_state: "CLOSED",
        failure_count: 0,
        health_status: "healthy",
        priority: 10,
      },
      {
        provider: "openlibrary",
        display_name: "Open Library",
        enabled: 1,
        capabilities: JSON.stringify({
          hasSearch: true,
          hasMetadataFetch: true,
          hasSync: false,
          requiresAuth: false,
        }),
        settings: JSON.stringify({
          baseUrl: "https://openlibrary.org/api",
          timeout: 5000,
        }),
        credentials: JSON.stringify({}),
        circuit_state: "CLOSED",
        failure_count: 0,
        health_status: "healthy",
        priority: 20,
      },
    ];
    
    const insertStmt = db.prepare(`
      INSERT INTO provider_configs (
        provider, display_name, enabled, capabilities, settings, credentials,
        circuit_state, failure_count, health_status, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const provider of providers) {
      insertStmt.run(
        provider.provider,
        provider.display_name,
        provider.enabled,
        provider.capabilities,
        provider.settings,
        provider.credentials,
        provider.circuit_state,
        provider.failure_count,
        provider.health_status,
        provider.priority
      );
      
      logger.info({ provider: provider.provider }, "Seeded provider config");
    }
    
    logger.info({ count: providers.length }, "Provider config seeding complete");
  }
};

export default migration;
