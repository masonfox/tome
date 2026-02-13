/**
 * Circuit Breaker Service
 * 
 * Implements the Circuit Breaker pattern for metadata providers to prevent
 * cascading failures and provide automatic recovery.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold exceeded, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 * 
 * See: specs/003-non-calibre-books/research.md (Decision 4: Circuit Breaker)
 */

import { getLogger } from "@/lib/logger";
import { providerConfigRepository } from "@/lib/repositories/provider-config.repository";
import type { ProviderId } from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "circuit-breaker" });

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms to wait before attempting recovery (OPEN → HALF_OPEN) */
  cooldownPeriod: number;
  /** Number of successful requests needed to close circuit from HALF_OPEN */
  successThreshold: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownPeriod: 60000, // 60 seconds
  successThreshold: 2,
};

/**
 * Circuit state for each provider
 */
interface CircuitState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  successCount: number; // Only used in HALF_OPEN
  lastFailure: Date | null;
  lastStateChange: Date;
}

/**
 * Circuit Breaker Service
 * 
 * Manages circuit breaker state for all providers with automatic
 * state transitions and failure tracking.
 */
export class CircuitBreakerService {
  private circuits: Map<ProviderId, CircuitState> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize circuit state for a provider
   */
  private async initializeCircuit(provider: ProviderId): Promise<CircuitState> {
    // Load persisted state from database
    const providerConfig = await providerConfigRepository.findByProvider(provider);

    const state: CircuitState = {
      state: providerConfig?.circuitState ?? "CLOSED",
      failureCount: providerConfig?.failureCount ?? 0,
      successCount: 0,
      lastFailure: providerConfig?.lastFailure ?? null,
      lastStateChange: new Date(),
    };

    this.circuits.set(provider, state);
    return state;
  }

  /**
   * Get or initialize circuit state for a provider
   */
  private async getCircuitState(provider: ProviderId): Promise<CircuitState> {
    let state = this.circuits.get(provider);
    if (!state) {
      state = await this.initializeCircuit(provider);
    }

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (state.state === "OPEN" && state.lastFailure) {
      const timeSinceFailure = Date.now() - state.lastFailure.getTime();
      if (timeSinceFailure >= this.config.cooldownPeriod) {
        await this.transitionTo(provider, "HALF_OPEN");
        state = this.circuits.get(provider)!;
      }
    }

    return state;
  }

  /**
   * Check if request can proceed through circuit
   * 
   * @returns true if request should proceed, false if circuit is OPEN
   */
  async canProceed(provider: ProviderId): Promise<boolean> {
    const state = await this.getCircuitState(provider);
    return state.state !== "OPEN";
  }

  /**
   * Record successful request
   */
  async recordSuccess(provider: ProviderId): Promise<void> {
    const state = await this.getCircuitState(provider);

    if (state.state === "HALF_OPEN") {
      state.successCount++;
      logger.debug(
        {
          provider,
          successCount: state.successCount,
          threshold: this.config.successThreshold,
        },
        "Circuit breaker success in HALF_OPEN state"
      );

      // Close circuit if success threshold met
      if (state.successCount >= this.config.successThreshold) {
        await this.transitionTo(provider, "CLOSED");
      }
    } else if (state.state === "CLOSED" && state.failureCount > 0) {
      // Reset failure count on success
      state.failureCount = 0;
      await providerConfigRepository.resetFailureCount(provider);
      logger.debug({ provider }, "Reset failure count after success");
    }
  }

  /**
   * Record failed request
   */
  async recordFailure(provider: ProviderId): Promise<void> {
    const state = await this.getCircuitState(provider);
    state.failureCount++;
    state.lastFailure = new Date();

    // Persist failure to database
    await providerConfigRepository.updateCircuitState(
      provider,
      state.state,
      state.failureCount,
      state.lastFailure
    );

    logger.warn(
      {
        provider,
        failureCount: state.failureCount,
        threshold: this.config.failureThreshold,
        currentState: state.state,
      },
      "Circuit breaker recorded failure"
    );

    // Transition to OPEN if threshold exceeded
    if (
      state.state === "CLOSED" &&
      state.failureCount >= this.config.failureThreshold
    ) {
      await this.transitionTo(provider, "OPEN");
    } else if (state.state === "HALF_OPEN") {
      // Any failure in HALF_OPEN goes back to OPEN
      await this.transitionTo(provider, "OPEN");
    }
  }

  /**
   * Transition circuit to new state
   */
  private async transitionTo(
    provider: ProviderId,
    newState: CircuitState["state"]
  ): Promise<void> {
    const state = this.circuits.get(provider);
    if (!state) {
      await this.initializeCircuit(provider);
      return;
    }

    const oldState = state.state;
    state.state = newState;
    state.lastStateChange = new Date();
    state.successCount = 0; // Reset success count on state change

    // Persist state to database
    await providerConfigRepository.updateCircuitState(provider, newState);

    // Update health status based on state
    const healthStatus = newState === "OPEN" ? "unavailable" : "healthy";
    await providerConfigRepository.updateHealth(
      provider,
      healthStatus,
      new Date()
    );

    logger.info(
      {
        provider,
        oldState,
        newState,
        failureCount: state.failureCount,
      },
      "Circuit breaker state transition"
    );
  }

  /**
   * Manually reset circuit to CLOSED state
   * 
   * Use when you know the provider is healthy again
   */
  async reset(provider: ProviderId): Promise<void> {
    const state = this.circuits.get(provider);
    if (state) {
      state.failureCount = 0;
      state.successCount = 0;
      state.lastFailure = null;
      await providerConfigRepository.resetFailureCount(provider);
    }

    await this.transitionTo(provider, "CLOSED");
    logger.info({ provider }, "Circuit breaker manually reset");
  }

  /**
   * Get current circuit state for a provider
   */
  async getState(provider: ProviderId): Promise<CircuitState["state"]> {
    const state = await this.getCircuitState(provider);
    return state.state;
  }

  /**
   * Get circuit statistics for a provider
   */
  async getStats(provider: ProviderId): Promise<{
    state: CircuitState["state"];
    failureCount: number;
    successCount: number;
    lastFailure: Date | null;
    timeUntilRetry: number | null;
  }> {
    const state = await this.getCircuitState(provider);

    let timeUntilRetry: number | null = null;
    if (state.state === "OPEN" && state.lastFailure) {
      const elapsed = Date.now() - state.lastFailure.getTime();
      timeUntilRetry = Math.max(0, this.config.cooldownPeriod - elapsed);
    }

    return {
      state: state.state,
      failureCount: state.failureCount,
      successCount: state.successCount,
      lastFailure: state.lastFailure,
      timeUntilRetry,
    };
  }
}

// Export singleton instance
export const circuitBreakerService = new CircuitBreakerService();
