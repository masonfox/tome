"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, AlertCircle, Loader2, ChevronDown, ChevronRight, X } from "lucide-react";
import BaseModal from "@/components/Modals/BaseModal";
import { BottomSheet } from "@/components/Layout/BottomSheet";
import { Button } from "@/components/Utilities/Button";
import { ProviderBadge } from "@/components/Providers/ProviderBadge";
import { SearchResultCard } from "@/components/Providers/SearchResultCard";
import { TagSelector } from "@/components/TagManagement/TagSelector";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";
import { invalidateBookQueries } from "@/hooks/useBookStatus";
import type { 
  FederatedSearchResponse, 
  ProviderSearchResult 
} from "@/lib/services/search.service";
import type { SearchResult, ProviderId } from "@/lib/providers/base/IMetadataProvider";
import type { ManualBookInput } from "@/lib/validation/manual-book.schema";
import type { PotentialDuplicate } from "@/lib/services/duplicate-detection.service";

const logger = getLogger().child({ component: "FederatedSearchModal" });

interface FederatedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bookId: number) => void;
}

interface SelectedResult {
  result: SearchResult;
  provider: ProviderId;
}

interface ValidationError {
  path: (string | number)[];
  message: string;
}

export default function FederatedSearchModal({
  isOpen,
  onClose,
  onSuccess,
}: FederatedSearchModalProps) {
  const queryClient = useQueryClient();

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<FederatedSearchResponse | null>(null);
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(new Set());

  // Selection and form state
  const [selectedResult, setSelectedResult] = useState<SelectedResult | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [series, setSeries] = useState("");
  const [seriesIndex, setSeriesIndex] = useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSearchResponse(null);
      setSelectedResult(null);
      setCollapsedProviders(new Set());
      resetForm();
    }
  }, [isOpen]);

  // Fetch available tags when modal opens
  useEffect(() => {
    if (isOpen) {
      fetch("/api/tags")
        .then((res) => res.json())
        .then((data) => setAvailableTags(data.tags || []))
        .catch((error) => {
          logger.error({ error }, "Failed to fetch available tags");
          setAvailableTags([]);
        });
    }
  }, [isOpen]);

  const resetForm = () => {
    setTitle("");
    setAuthors("");
    setIsbn("");
    setPublisher("");
    setPubDate("");
    setTotalPages("");
    setDescription("");
    setTags([]);
    setSeries("");
    setSeriesIndex("");
    setValidationErrors({});
    setDuplicates([]);
    setShowDuplicateWarning(false);
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setIsSearching(true);
    setSearchResponse(null);
    setSelectedResult(null);

    try {
      const response = await fetch("/api/providers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Search failed");
        return;
      }

      const { data }: { data: FederatedSearchResponse } = await response.json();
      setSearchResponse(data);

      logger.info(
        {
          query,
          totalResults: data.totalResults,
          successfulProviders: data.successfulProviders,
          failedProviders: data.failedProviders,
        },
        "Search completed"
      );

      if (data.totalResults === 0) {
        toast.info("No results found. Try a different search or add manually.");
      }
    } catch (error) {
      logger.error({ error }, "Search request failed");
      toast.error("Failed to search providers. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = async (result: SearchResult, provider: ProviderId) => {
    setSelectedResult({ result, provider });
    setIsFetchingMetadata(true);
    
    try {
      // Fetch full metadata from provider
      const response = await fetch(`/api/providers/${provider}/metadata/${result.externalId}`);
      
      if (!response.ok) {
        // Fallback to basic search result data if metadata fetch fails
        logger.warn({ provider, externalId: result.externalId }, "Failed to fetch full metadata, using search result data");
        prefillFromSearchResult(result);
      } else {
        const { data } = await response.json();
        
        // Pre-fill form with full metadata
        setTitle(data.title || result.title);
        setAuthors((data.authors || result.authors).join(", "));
        setIsbn(data.isbn || result.isbn || "");
        setPublisher(data.publisher || "");
        setPubDate(data.pubDate ? new Date(data.pubDate).toISOString().split("T")[0] : "");
        setDescription(data.description || "");
        setTags(data.tags || []);
        setTotalPages(data.totalPages?.toString() || result.totalPages?.toString() || "");
        setSeries(data.series || "");
        setSeriesIndex(data.seriesIndex?.toString() || "");
        
        logger.info(
          { 
            provider, 
            externalId: result.externalId,
            hasDescription: !!data.description,
            hasTags: !!data.tags,
            hasPublisher: !!data.publisher,
            hasSeries: !!data.series
          }, 
          "Fetched full metadata for selected book"
        );
      }
    } catch (error) {
      logger.error({ error, provider, externalId: result.externalId }, "Error fetching metadata");
      prefillFromSearchResult(result);
    } finally {
      setIsFetchingMetadata(false);
    }

    // Check for duplicates
    checkForDuplicates(result.title, result.authors);
  };
  
  const prefillFromSearchResult = (result: SearchResult) => {
    // Fallback: use basic search result data
    setTitle(result.title);
    setAuthors(result.authors.join(", "));
    setIsbn(result.isbn || "");
    setPublisher(result.publisher || "");
    setPubDate(result.pubDate ? new Date(result.pubDate).toISOString().split("T")[0] : "");
    setDescription("");
    setTags([]);
    setTotalPages(result.totalPages?.toString() || "");
    setSeries("");
    setSeriesIndex("");
  };

  const checkForDuplicates = async (bookTitle: string, bookAuthors: string[]) => {
    try {
      const response = await fetch("/api/books/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bookTitle,
          authors: bookAuthors,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.duplicates?.hasDuplicates) {
          setDuplicates(data.duplicates.duplicates);
        } else {
          setDuplicates([]);
        }
      }
    } catch (error) {
      logger.error({ error }, "Failed to check for duplicates");
    }
  };

  const handleBack = () => {
    if (showDuplicateWarning) {
      setShowDuplicateWarning(false);
    } else if (selectedResult) {
      setSelectedResult(null);
      resetForm();
    } else {
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!selectedResult) return;

    // Clear previous errors
    setValidationErrors({});

    // Parse authors
    const authorList = authors
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a);

    if (!title.trim()) {
      setValidationErrors({ title: "Title is required" });
      return;
    }

    if (authorList.length === 0) {
      setValidationErrors({ authors: "At least one author is required" });
      return;
    }

    // Show duplicate warning if duplicates exist and not already shown
    if (duplicates.length > 0 && !showDuplicateWarning) {
      setShowDuplicateWarning(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare payload - books from provider search are manual books
      // with pre-populated metadata (provider is ephemeral, not stored)
      const payload: any = {
        title: title.trim(),
        authors: authorList,
      };

      // Add optional fields
      if (isbn.trim()) payload.isbn = isbn.trim();
      if (publisher.trim()) payload.publisher = publisher.trim();
      if (pubDate.trim()) payload.pubDate = new Date(pubDate);
      if (totalPages.trim()) payload.totalPages = parseInt(totalPages, 10);
      if (description.trim()) payload.description = description.trim();
      if (tags.length > 0) {
        payload.tags = tags;
      }
      if (series.trim()) payload.series = series.trim();
      if (seriesIndex.trim()) payload.seriesIndex = parseFloat(seriesIndex);
      if (selectedResult.result.coverImageUrl) {
        payload.coverImageUrl = selectedResult.result.coverImageUrl;
      }

      // Submit to API
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        
        if (error.details) {
          // Zod validation errors
          const errors: Record<string, string> = {};
          error.details.forEach((err: ValidationError) => {
            const field = err.path[0] as string;
            errors[field] = err.message;
          });
          setValidationErrors(errors);
        } else {
          toast.error(error.error || "Failed to create book");
        }
        return;
      }

      const result = await response.json();
      logger.info({ bookId: result.book.id, source: payload.source }, "Book created from provider search");
      
      // If cover was provided, invalidate cache after a delay to allow server-side download
      // Server downloads cover asynchronously (fire-and-forget), so we invalidate cache
      // to ensure the book page refetches with updated timestamp when cover is ready
      if (payload.coverImageUrl) {
        // Delay invalidation to give server time to download and save cover
        setTimeout(() => {
          invalidateBookQueries(queryClient, result.book.id.toString());
          logger.info({ bookId: result.book.id }, "Cache invalidated after cover download delay");
        }, 2000); // 2 second delay for server-side download
      }
      
      toast.success(`"${result.book.title}" added to your library`);
      onSuccess(result.book.id);
      onClose();
    } catch (error) {
      logger.error({ error }, "Failed to create book from search result");
      toast.error("Failed to create book. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProviderCollapse = (provider: string) => {
    setCollapsedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const renderSearchView = () => (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--subheading-text)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by title, author, or ISBN..."
            className="w-full pl-10 pr-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
            disabled={isSearching}
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Searching...
            </>
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {/* Search Results */}
      {searchResponse && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--subheading-text)]">
              Found {searchResponse.totalResults} result{searchResponse.totalResults !== 1 ? "s" : ""} 
              {" "}from {searchResponse.successfulProviders} provider{searchResponse.successfulProviders !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Results by Provider */}
          {searchResponse.results.map((providerResult) => (
            <div key={providerResult.provider} className="border border-[var(--border-color)] rounded-lg overflow-hidden">
              {/* Provider Header */}
              <button
                onClick={() => toggleProviderCollapse(providerResult.provider)}
                className="w-full px-4 py-3 bg-[var(--card-bg-emphasis)] flex items-center justify-between hover:bg-[var(--card-bg-emphasis)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {collapsedProviders.has(providerResult.provider) ? (
                    <ChevronRight className="w-4 h-4 text-[var(--subheading-text)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--subheading-text)]" />
                  )}
                  <ProviderBadge
                    source={providerResult.provider as ProviderId}
                    status={providerResult.status}
                    showStatus
                  />
                  <span className="text-sm text-[var(--subheading-text)]">
                    {providerResult.results.length} result{providerResult.results.length !== 1 ? "s" : ""}
                    {providerResult.duration && ` • ${providerResult.duration}ms`}
                  </span>
                </div>
              </button>

              {/* Provider Results */}
              {!collapsedProviders.has(providerResult.provider) && (
                <div className="p-4 space-y-2">
                  {providerResult.status === "success" && providerResult.results.length > 0 ? (
                    providerResult.results.map((result, index) => (
                      <SearchResultCard
                        key={`${result.externalId}-${index}`}
                        result={result}
                        provider={providerResult.provider as ProviderId}
                        onClick={() => handleSelectResult(result, providerResult.provider as ProviderId)}
                      />
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-[var(--subheading-text)] py-4">
                      <AlertCircle className="w-4 h-4" />
                      <span>
                        {providerResult.status === "timeout"
                          ? "Request timed out"
                          : providerResult.error || "No results found"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* All Providers Failed */}
          {searchResponse.successfulProviders === 0 && (
            <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center">
              <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
              <p className="font-medium text-[var(--foreground)] mb-1">
                All providers failed
              </p>
              <p className="text-sm text-[var(--subheading-text)] mb-4">
                Unable to search any external providers. Please try again later.
              </p>
              <Button variant="secondary" onClick={onClose}>
                Add Manually Instead
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderDuplicateWarning = () => (
    <div className="space-y-4">
      <p className="text-sm text-[var(--subheading-text)]">
        The following {duplicates.length === 1 ? "book" : "books"} in your library {duplicates.length === 1 ? "appears" : "appear"} similar:
      </p>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {duplicates.map((dup) => (
          <div
            key={dup.bookId}
            className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm text-[var(--foreground)]">
                  {dup.title}
                </p>
                <p className="text-xs text-[var(--subheading-text)]">
                  by {dup.authors.join(", ")}
                </p>
                <p className="text-xs text-[var(--subheading-text)] mt-1">
                  Source: {dup.source} • {dup.similarity.toFixed(0)}% similar
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEditForm = () => (
    <div className="space-y-4">
      {/* Title - Required */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
          placeholder="Enter book title"
        />
        {validationErrors.title && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.title}</p>
        )}
      </div>

      {/* Authors - Required */}
      <div>
        <label htmlFor="authors" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
          Authors <span className="text-red-500">*</span>
        </label>
        <input
          id="authors"
          type="text"
          value={authors}
          onChange={(e) => setAuthors(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
          placeholder="e.g., Jane Doe, John Smith (comma-separated)"
        />
        {validationErrors.authors && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.authors}</p>
        )}
      </div>

      {/* Optional fields in grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* ISBN */}
        <div>
          <label htmlFor="isbn" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
            ISBN
          </label>
          <input
            id="isbn"
            type="text"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
            placeholder="ISBN-10 or ISBN-13"
          />
        </div>

        {/* Total Pages */}
        <div>
          <label htmlFor="totalPages" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
            Total Pages
          </label>
          <input
            id="totalPages"
            type="number"
            min="1"
            max="10000"
            value={totalPages}
            onChange={(e) => setTotalPages(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
            placeholder="e.g., 350"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Publisher */}
        <div>
          <label htmlFor="publisher" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
            Publisher
          </label>
          <input
            id="publisher"
            type="text"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
            placeholder="e.g., Penguin Books"
          />
        </div>

        {/* Publication Date */}
        <div>
          <label htmlFor="pubDate" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
            Publication Date
          </label>
          <input
            id="pubDate"
            type="date"
            value={pubDate}
            onChange={(e) => setPubDate(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
          />
        </div>
      </div>

      {/* Series fields */}
      <div className="grid grid-cols-2 gap-4">
        {/* Series */}
        <div>
          <label htmlFor="series" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
            Series
          </label>
          <input
            id="series"
            type="text"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
            placeholder="e.g., Harry Potter"
          />
        </div>

        {/* Series Index */}
        <div>
          <label htmlFor="seriesIndex" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
            Series Index
          </label>
          <input
            id="seriesIndex"
            type="number"
            min="0"
            step="0.1"
            value={seriesIndex}
            onChange={(e) => setSeriesIndex(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
            placeholder="e.g., 1"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
          Tags
        </label>
        <TagSelector
          availableTags={availableTags}
          selectedTags={tags}
          onTagsChange={setTags}
          disabled={false}
          allowCreate={true}
          placeholder="Search or create tags..."
        />
        <p className="text-xs text-[var(--subheading-text)] mt-1">
          Click tags to select, or press Enter to add and continue typing
        </p>
        
        {/* Current Tags Display */}
        {tags.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--subheading-text)]">
                Selected ({tags.length})
              </span>
              <button
                type="button"
                onClick={() => setTags([])}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Button
                  key={`${tag}-${index}`}
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  variant="primary"
                  size="sm"
                  iconAfter={<X className="w-3.5 h-3.5" />}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
          placeholder="Brief description or notes about the book"
        />
      </div>

      {/* Duplicate warning inline */}
      {duplicates.length > 0 && !showDuplicateWarning && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            ⚠️ Potential duplicate{duplicates.length > 1 ? "s" : ""} found
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            {duplicates.length} similar book{duplicates.length > 1 ? "s" : ""} already in your library
          </p>
        </div>
      )}
    </div>
  );

  // Determine modal title and subtitle
  let modalTitle = "Search Providers";
  let modalSubtitle = "Search Hardcover and Open Library for books";
  let modalIcon = <Search className="w-5 h-5" />;

  if (showDuplicateWarning) {
    modalTitle = "Potential Duplicates Found";
    modalSubtitle = "We found books that might be duplicates. Proceed anyway?";
    modalIcon = <AlertCircle className="w-5 h-5" />;
  } else if (selectedResult) {
    modalTitle = "Add Book from Search";
    modalSubtitle = "Review and edit metadata before adding";
    modalIcon = <Search className="w-5 h-5" />;
  }

  // Modal content
  const modalContent = showDuplicateWarning
    ? renderDuplicateWarning()
    : selectedResult
    ? renderEditForm()
    : renderSearchView();

  // Modal actions
  const modalActions = selectedResult ? (
    <>
      <Button variant="ghost" onClick={handleBack} disabled={isSubmitting || isFetchingMetadata}>
        {showDuplicateWarning ? "Go Back" : "Back to Results"}
      </Button>
      <Button onClick={handleSubmit} disabled={isSubmitting || isFetchingMetadata}>
        {showDuplicateWarning ? "Add Anyway" : "Add Book"}
      </Button>
    </>
  ) : (
    <Button variant="ghost" onClick={onClose}>
      Close
    </Button>
  );

  // Render as BottomSheet on mobile, BaseModal on desktop
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        icon={modalIcon}
        size="full"
        allowBackdropClose={!isSubmitting && !isFetchingMetadata}
        actions={modalActions}
      >
        {modalContent}
      </BottomSheet>
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      size="xl"
      loading={isSubmitting || isFetchingMetadata}
      actions={modalActions}
      allowBackdropClose={false}
    >
      {modalContent}
    </BaseModal>
  );
}
