"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileUp, Loader2, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type ImportStep = "upload" | "preview" | "complete";
type Provider = "goodreads" | "storygraph" | null;

interface PreviewStats {
  exactMatches: number;
  highConfidenceMatches: number;
  mediumConfidenceMatches: number;
  lowConfidenceMatches: number;
  unmatchedRecords: number;
}

interface ImportResult {
  sessionsCreated: number;
  sessionsSkipped: number;
  ratingsSync: number;
  unmatchedRecords: number;
}

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [provider, setProvider] = useState<Provider>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportingUnmatched, setExportingUnmatched] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }

      // Validate file size (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !provider) {
      toast.error("Please select a provider and file");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("provider", provider);

      const response = await fetch("/api/import/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }

      // Store import ID and preview stats
      setImportId(data.importId);
      setPreviewStats({
        exactMatches: data.preview.exactMatches || 0,
        highConfidenceMatches: data.preview.highConfidenceMatches || 0,
        mediumConfidenceMatches: data.preview.mediumConfidenceMatches || 0,
        lowConfidenceMatches: data.preview.lowConfidenceMatches || 0,
        unmatchedRecords: data.preview.unmatchedRecords || 0,
      });

      toast.success(`Parsed ${data.totalRecords} records successfully!`);
      setStep("preview");
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleExecute = async () => {
    if (!importId) return;

    setExecuting(true);

    try {
      const response = await fetch(`/api/import/${importId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmedMatches: [], // Empty means import all matches
          skipRecords: [],
          forceDuplicates: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Import failed");
        return;
      }

      setImportResult({
        sessionsCreated: data.summary.sessionsCreated,
        sessionsSkipped: data.summary.sessionsSkipped,
        ratingsSync: data.summary.ratingsSync,
        unmatchedRecords: data.summary.unmatchedRecords,
      });

      toast.success("Import completed successfully!");
      setStep("complete");
    } catch (error) {
      toast.error("Failed to execute import");
    } finally {
      setExecuting(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setProvider(null);
    setFile(null);
    setImportId(null);
    setPreviewStats(null);
    setImportResult(null);
  };

  const handleExportUnmatched = async () => {
    if (!importId) return;

    setExportingUnmatched(true);

    try {
      const response = await fetch(`/api/import/${importId}/unmatched?format=csv`);

      if (!response.ok) {
        toast.error("Failed to export unmatched records");
        return;
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `unmatched-records-${importId}.csv`;

      // Download the CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Unmatched records exported successfully!");
    } catch (error) {
      toast.error("Failed to export unmatched records");
    } finally {
      setExportingUnmatched(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Import Reading History"
        subtitle="Import your books from Goodreads or TheStoryGraph"
        icon={Upload}
      />

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-8">
            <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
              Choose Your Provider
            </h2>

            {/* Provider Selection */}
            <div className="space-y-4 mb-8">
              <button
                onClick={() => setProvider("goodreads")}
                className={`w-full p-4 border-2 rounded-md text-left transition-all ${
                  provider === "goodreads"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border-color)] hover:border-[var(--accent)]/50"
                }`}
              >
                <div className="font-semibold text-lg">Goodreads</div>
                <div className="text-sm text-[var(--subheading-text)] mt-1">
                  Export from: My Books → Import and Export → Export Library
                </div>
              </button>

              <button
                onClick={() => setProvider("storygraph")}
                className={`w-full p-4 border-2 rounded-md text-left transition-all ${
                  provider === "storygraph"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border-color)] hover:border-[var(--accent)]/50"
                }`}
              >
                <div className="font-semibold text-lg">TheStoryGraph</div>
                <div className="text-sm text-[var(--subheading-text)] mt-1">
                  Export from: Profile → Export → Export Reading History
                </div>
              </button>
            </div>

            {/* File Upload */}
            {provider && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)]/70 mb-2">
                    Upload CSV File
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex items-center justify-center w-full p-6 border-2 border-dashed border-[var(--border-color)] rounded-md cursor-pointer hover:border-[var(--accent)] transition-colors"
                    >
                      <div className="text-center">
                        <FileUp className="w-8 h-8 mx-auto mb-2 text-[var(--accent)]" />
                        <div className="text-sm font-medium">
                          {file ? file.name : "Click to select CSV file"}
                        </div>
                        <div className="text-xs text-[var(--subheading-text)] mt-1">
                          Maximum file size: 10MB
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="w-full px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
                >
                  {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {uploading ? "Uploading..." : "Upload and Parse"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && previewStats && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-8">
            <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
              Import Preview
            </h2>

            <div className="space-y-4 mb-8">
              {/* Exact Matches */}
              <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-md">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="font-semibold">Exact Matches</div>
                    <div className="text-sm text-[var(--subheading-text)]">
                      100% confidence (ISBN match)
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-500">
                  {previewStats.exactMatches}
                </div>
              </div>

              {/* High Confidence */}
              <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/30 rounded-md">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="font-semibold">High Confidence</div>
                    <div className="text-sm text-[var(--subheading-text)]">
                      85-99% confidence (fuzzy match)
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-500">
                  {previewStats.highConfidenceMatches}
                </div>
              </div>

              {/* Medium Confidence */}
              {previewStats.mediumConfidenceMatches > 0 && (
                <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <div>
                      <div className="font-semibold">Medium Confidence</div>
                      <div className="text-sm text-[var(--subheading-text)]">
                        70-84% confidence
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-yellow-500">
                    {previewStats.mediumConfidenceMatches}
                  </div>
                </div>
              )}

              {/* Low Confidence */}
              {previewStats.lowConfidenceMatches > 0 && (
                <div className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/30 rounded-md">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    <div>
                      <div className="font-semibold">Low Confidence</div>
                      <div className="text-sm text-[var(--subheading-text)]">
                        50-69% confidence
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-orange-500">
                    {previewStats.lowConfidenceMatches}
                  </div>
                </div>
              )}

              {/* Unmatched */}
              {previewStats.unmatchedRecords > 0 && (
                <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-md">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <div>
                      <div className="font-semibold">Unmatched</div>
                      <div className="text-sm text-[var(--subheading-text)]">
                        Not found in your library
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-red-500">
                    {previewStats.unmatchedRecords}
                  </div>
                </div>
              )}
            </div>

            {/* Info about unmatched records */}
            {previewStats.unmatchedRecords > 0 && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-md">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-[var(--subheading-text)]">
                    <strong className="text-[var(--heading-text)]">Note:</strong> Unmatched books will be skipped during import. 
                    You&apos;ll be able to export a list of these books after the import completes.
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 border border-[var(--border-color)] rounded-md hover:bg-[var(--border-color)]/10 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="flex-1 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
              >
                {executing && <Loader2 className="w-4 h-4 animate-spin" />}
                {executing ? "Importing..." : "Confirm Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === "complete" && importResult && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-8">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)]">
                Import Complete!
              </h2>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex justify-between p-3 bg-[var(--background)]/50 rounded">
                <span className="text-[var(--subheading-text)]">Sessions Created</span>
                <span className="font-bold">{importResult.sessionsCreated}</span>
              </div>
              <div className="flex justify-between p-3 bg-[var(--background)]/50 rounded">
                <span className="text-[var(--subheading-text)]">Sessions Skipped (Duplicates)</span>
                <span className="font-bold">{importResult.sessionsSkipped}</span>
              </div>
              <div className="flex justify-between p-3 bg-[var(--background)]/50 rounded">
                <span className="text-[var(--subheading-text)]">Ratings Synced</span>
                <span className="font-bold">{importResult.ratingsSync}</span>
              </div>
              {importResult.unmatchedRecords > 0 && (
                <div className="flex justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                  <span className="text-[var(--subheading-text)]">Unmatched Records</span>
                  <span className="font-bold">{importResult.unmatchedRecords}</span>
                </div>
              )}
            </div>

            {/* Export Unmatched Records */}
            {importResult.unmatchedRecords > 0 && (
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--heading-text)] mb-1">
                      {importResult.unmatchedRecords} book{importResult.unmatchedRecords !== 1 ? "s" : ""} could not be matched
                    </h3>
                    <p className="text-sm text-[var(--subheading-text)] mb-3">
                      These books were not found in your Calibre library. Export them to see which books to add.
                    </p>
                    <button
                      onClick={handleExportUnmatched}
                      disabled={exportingUnmatched}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
                    >
                      {exportingUnmatched ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Export Unmatched Records (CSV)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => (window.location.href = "/library")}
                className="flex-1 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-semibold"
              >
                View Library
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 border border-[var(--border-color)] rounded-md hover:bg-[var(--border-color)]/10 transition-colors font-semibold"
              >
                Import Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
