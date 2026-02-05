import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const providerConfigs = sqliteTable(
  "provider_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Provider identifier (calibre, manual, hardcover, openlibrary)
    provider: text("provider", {
      enum: ["calibre", "manual", "hardcover", "openlibrary"],
    })
      .notNull()
      .unique(),
    // Display name for UI
    displayName: text("display_name").notNull(),
    // Provider enabled/disabled state
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    // Provider capabilities (JSON)
    capabilities: text("capabilities", { mode: "json" })
      .$type<{
        hasSearch: boolean;
        hasMetadataFetch: boolean;
        hasSync: boolean;
        requiresAuth: boolean;
      }>()
      .notNull(),
    // Provider-specific settings (JSON)
    settings: text("settings", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    // Provider credentials (JSON, plaintext acceptable for local deployment)
    credentials: text("credentials", { mode: "json" })
      .$type<Record<string, string>>()
      .default(sql`'{}'`),
    // Circuit breaker state
    circuitState: text("circuit_state", {
      enum: ["CLOSED", "OPEN", "HALF_OPEN"],
    })
      .notNull()
      .default("CLOSED"),
    // Circuit breaker last failure timestamp
    lastFailure: integer("last_failure", { mode: "timestamp" }),
    // Circuit breaker failure count
    failureCount: integer("failure_count").notNull().default(0),
    // Health status (healthy/unavailable)
    healthStatus: text("health_status", { enum: ["healthy", "unavailable"] })
      .notNull()
      .default("healthy"),
    // Last health check timestamp
    lastHealthCheck: integer("last_health_check", { mode: "timestamp" }),
    // Priority for provider ordering (lower = higher priority)
    priority: integer("priority").notNull().default(100),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Index for enabled providers
    enabledIdx: index("idx_provider_configs_enabled").on(table.enabled),
    // Index for priority ordering
    priorityIdx: index("idx_provider_configs_priority").on(table.priority),
  })
);

export type ProviderConfig = typeof providerConfigs.$inferSelect;
export type NewProviderConfig = typeof providerConfigs.$inferInsert;
