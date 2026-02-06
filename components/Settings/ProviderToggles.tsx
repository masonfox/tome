"use client";

import { useState } from "react";
import { Power, RefreshCw, Activity } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  capabilities: {
    hasSearch: boolean;
    hasMetadataFetch: boolean;
    hasSync: boolean;
    requiresAuth: boolean;
  };
  enabled: boolean;
  healthStatus: string;
  circuitState: string;
  failureCount: number;
}

interface ProviderTogglesProps {
  providers: Provider[];
  onToggle: (providerId: string, enabled: boolean) => Promise<void>;
  onHealthCheck: (providerId: string) => Promise<void>;
}

export function ProviderToggles({
  providers,
  onToggle,
  onHealthCheck,
}: ProviderTogglesProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  async function handleToggle(providerId: string, currentEnabled: boolean) {
    setTogglingId(providerId);
    try {
      await onToggle(providerId, !currentEnabled);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleHealthCheck(providerId: string) {
    setCheckingId(providerId);
    try {
      await onHealthCheck(providerId);
    } finally {
      setCheckingId(null);
    }
  }

  function getStatusColor(provider: Provider) {
    if (!provider.enabled) return "text-[var(--foreground)]/40";
    if (provider.circuitState === "OPEN") return "text-red-500";
    if (provider.healthStatus === "unavailable") return "text-orange-500";
    return "text-green-500";
  }

  function getStatusText(provider: Provider) {
    if (!provider.enabled) return "Disabled";
    if (provider.circuitState === "OPEN")
      return `Circuit Open (${provider.failureCount} failures)`;
    if (provider.healthStatus === "unavailable") return "Unavailable";
    return "Healthy";
  }

  return (
    <div className="space-y-3">
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="flex items-center justify-between p-4 bg-[var(--background)] border border-[var(--border-color)] rounded-md hover:border-[var(--accent)]/50 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h4 className="font-semibold text-[var(--foreground)]">
                {provider.name}
              </h4>
              {provider.capabilities.requiresAuth && (
                <span className="text-xs px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full font-medium">
                  Requires API Key
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Activity className={`w-3 h-3 ${getStatusColor(provider)}`} />
              <span
                className={`text-sm font-medium ${getStatusColor(provider)}`}
              >
                {getStatusText(provider)}
              </span>
            </div>
            <div className="flex gap-3 mt-2 text-xs text-[var(--subheading-text)]">
              {provider.capabilities.hasSearch && (
                <span className="font-medium">🔍 Search</span>
              )}
              {provider.capabilities.hasMetadataFetch && (
                <span className="font-medium">📚 Metadata</span>
              )}
              {provider.capabilities.hasSync && (
                <span className="font-medium">🔄 Sync</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Health Check Button */}
            <button
              onClick={() => handleHealthCheck(provider.id)}
              disabled={checkingId === provider.id || !provider.enabled}
              className="p-2 rounded-md border border-[var(--border-color)] hover:bg-[var(--border-color)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Run health check"
            >
              <RefreshCw
                className={`w-4 h-4 text-[var(--foreground)] ${
                  checkingId === provider.id ? "animate-spin" : ""
                }`}
              />
            </button>

            {/* Enable/Disable Toggle */}
            <button
              onClick={() => handleToggle(provider.id, provider.enabled)}
              disabled={togglingId === provider.id}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                provider.enabled
                  ? "bg-[var(--accent)]"
                  : "bg-[var(--foreground)]/20"
              }`}
              title={provider.enabled ? "Disable provider" : "Enable provider"}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  provider.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
