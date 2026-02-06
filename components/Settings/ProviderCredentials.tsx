"use client";

import { useState } from "react";
import { Key, Eye, EyeOff, AlertCircle } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  capabilities: {
    requiresAuth: boolean;
  };
  enabled: boolean;
  hasCredentials: boolean;
}

interface ProviderCredentialsProps {
  providers: Provider[];
  onUpdateCredentials: (
    providerId: string,
    credentials: Record<string, string>
  ) => Promise<void>;
}

export function ProviderCredentials({
  providers,
  onUpdateCredentials,
}: ProviderCredentialsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const providersRequiringAuth = providers.filter(
    (p) => p.capabilities.requiresAuth
  );

  if (providersRequiringAuth.length === 0) {
    return null;
  }

  async function handleSaveCredentials(providerId: string) {
    const apiKey = apiKeys[providerId]?.trim();

    if (!apiKey) {
      setErrors((prev) => ({
        ...prev,
        [providerId]: "API key cannot be empty",
      }));
      return;
    }

    setSaving(providerId);
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[providerId];
      return newErrors;
    });

    try {
      await onUpdateCredentials(providerId, { apiKey });
      // Clear the input after successful save
      setApiKeys((prev) => {
        const newKeys = { ...prev };
        delete newKeys[providerId];
        return newKeys;
      });
      setExpandedId(null);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [providerId]:
          error instanceof Error
            ? error.message
            : "Failed to save credentials",
      }));
    } finally {
      setSaving(null);
    }
  }

  function toggleExpand(providerId: string) {
    setExpandedId(expandedId === providerId ? null : providerId);
  }

  function toggleShowKey(providerId: string) {
    setShowKey((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  }

  return (
    <div className="space-y-3">
      {providersRequiringAuth.map((provider) => {
        const isExpanded = expandedId === provider.id;
        const isSaving = saving === provider.id;
        const hasError = !!errors[provider.id];
        const currentValue = apiKeys[provider.id] || "";

        return (
          <div
            key={provider.id}
            className="border border-[var(--border-color)] rounded-md overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => toggleExpand(provider.id)}
              className="w-full flex items-center justify-between p-4 bg-[var(--background)] hover:bg-[var(--border-color)]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-[var(--accent)]" />
                <div className="text-left">
                  <h4 className="font-semibold text-[var(--foreground)]">
                    {provider.name}
                  </h4>
                  <p className="text-sm text-[var(--subheading-text)]">
                    {provider.hasCredentials
                      ? "API key configured"
                      : "No API key configured"}
                  </p>
                </div>
              </div>
              <div
                className={`transform transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              >
                <svg
                  className="w-5 h-5 text-[var(--foreground)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="p-4 bg-[var(--card-bg)] border-t border-[var(--border-color)]">
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={`api-key-${provider.id}`}
                      className="block text-sm font-semibold text-[var(--foreground)]/70 mb-2"
                    >
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        id={`api-key-${provider.id}`}
                        type={showKey[provider.id] ? "text" : "password"}
                        value={currentValue}
                        onChange={(e) =>
                          setApiKeys((prev) => ({
                            ...prev,
                            [provider.id]: e.target.value,
                          }))
                        }
                        placeholder={
                          provider.hasCredentials
                            ? "Enter new API key to update"
                            : "Enter your API key"
                        }
                        className="w-full px-4 py-2 pr-12 bg-[var(--background)] border border-[var(--border-color)] rounded-md text-[var(--foreground)] font-mono text-sm focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent"
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(provider.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--border-color)]/30 rounded transition-colors"
                        title={showKey[provider.id] ? "Hide" : "Show"}
                      >
                        {showKey[provider.id] ? (
                          <EyeOff className="w-4 h-4 text-[var(--foreground)]/60" />
                        ) : (
                          <Eye className="w-4 h-4 text-[var(--foreground)]/60" />
                        )}
                      </button>
                    </div>
                  </div>

                  {hasError && (
                    <div className="flex items-center gap-2 text-sm text-red-500">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors[provider.id]}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[var(--subheading-text)]">
                      {provider.id === "hardcover" && (
                        <>
                          Get your API key from{" "}
                          <a
                            href="https://hardcover.app/account/api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--accent)] hover:underline font-medium"
                          >
                            Hardcover Settings
                          </a>
                        </>
                      )}
                    </p>
                    <button
                      onClick={() => handleSaveCredentials(provider.id)}
                      disabled={isSaving || !currentValue.trim()}
                      className="px-4 py-2 bg-[var(--accent)] text-white font-semibold rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
