"use client";

import { useEffect, useState, useCallback } from "react";
import { Plug, AlertCircle, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/Layout/PageHeader";
import { ProviderToggles } from "@/components/Settings/ProviderToggles";
import { ProviderCredentials } from "@/components/Settings/ProviderCredentials";

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
  priority: number;
  settings: Record<string, unknown>;
  hasCredentials: boolean;
}

interface ProvidersResponse {
  providers: Provider[];
  count: number;
}

export default function ProvidersSettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/providers");
      
      if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.statusText}`);
      }

      const data: ProvidersResponse = await response.json();
      setProviders(data.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  async function handleToggleProvider(providerId: string, enabled: boolean) {
    try {
      setError(null);
      const response = await fetch(`/api/providers/${providerId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update provider");
      }

      // Refresh providers list
      await fetchProviders();
      
      setSuccessMessage(
        `${providerId} ${enabled ? "enabled" : "disabled"} successfully`
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle provider");
    }
  }

  async function handleUpdateCredentials(
    providerId: string,
    credentials: Record<string, string>
  ) {
    try {
      setError(null);
      const response = await fetch(`/api/providers/${providerId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update credentials");
      }

      // Refresh providers list
      await fetchProviders();
      
      setSuccessMessage(`Credentials updated for ${providerId}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update credentials"
      );
      throw err; // Re-throw so component can handle it
    }
  }

  if (loading) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Provider Settings"
          subtitle="Configure metadata providers"
          icon={Plug}
        />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--accent)] border-t-transparent"></div>
            <p className="mt-4 text-[var(--subheading-text)]">
              Loading providers...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Provider Settings"
        subtitle="Configure metadata providers and API credentials"
        icon={Plug}
      />

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-md">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-500 font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-md">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-500 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Provider Toggles */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
        <div className="mb-4">
          <h3 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-2">
            Active Providers
          </h3>
          <p className="text-sm text-[var(--subheading-text)] font-medium">
            Enable or disable metadata providers. Disabled providers will not be
            used for searches or syncing.
          </p>
        </div>
        <ProviderToggles
          providers={providers}
          onToggle={handleToggleProvider}
        />
      </div>

      {/* API Credentials */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-6">
        <div className="mb-4">
          <h3 className="text-xl font-serif font-bold text-[var(--heading-text)] mb-2">
            API Credentials
          </h3>
          <p className="text-sm text-[var(--subheading-text)] font-medium">
            Configure API keys for providers that require authentication. Your
            credentials are stored securely and only used to access provider
            APIs.
          </p>
        </div>
        <ProviderCredentials
          providers={providers}
          onUpdateCredentials={handleUpdateCredentials}
        />
      </div>

      {/* Info Section */}
      <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-md p-6">
        <h4 className="font-semibold text-[var(--foreground)] mb-2">
          About Providers
        </h4>
        <div className="space-y-2 text-sm text-[var(--subheading-text)]">
          <p>
            <strong className="text-[var(--foreground)]">Calibre:</strong>{" "}
            Syncs books from your Calibre library. Always enabled when Calibre
            is configured.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Local:</strong>{" "}
            Allows you to add books locally without external metadata. Always
            enabled.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Hardcover:</strong>{" "}
            Fetches book metadata from Hardcover.app. Requires an API key.
          </p>
          <p>
            <strong className="text-[var(--foreground)]">
              Open Library:
            </strong>{" "}
            Fetches book metadata from OpenLibrary.org. Free public API, no
            authentication required.
          </p>
        </div>
      </div>
    </div>
  );
}
