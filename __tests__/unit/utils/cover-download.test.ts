import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadCover } from "@/lib/utils/cover-download";

// Mock fetch globally for these tests
const originalFetch = global.fetch;

/** Helper to create a mock response with proper ArrayBuffer from a Buffer */
function mockResponse(opts: {
  ok: boolean;
  status: number;
  headers?: Headers;
  body?: Buffer;
}) {
  const headers = opts.headers ?? new Headers();
  return {
    ok: opts.ok,
    status: opts.status,
    headers,
    arrayBuffer: opts.body
      ? vi.fn().mockResolvedValue(
          opts.body.buffer.slice(opts.body.byteOffset, opts.body.byteOffset + opts.body.byteLength)
        )
      : undefined,
  };
}

function setMockFetch(impl: (...args: any[]) => any) {
  (global as any).fetch = vi.fn(impl);
}

function setMockFetchResolved(response: ReturnType<typeof mockResponse>) {
  (global as any).fetch = vi.fn().mockResolvedValue(response);
}

function setMockFetchRejected(error: Error | DOMException) {
  (global as any).fetch = vi.fn().mockRejectedValue(error);
}

describe("cover-download", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("URL validation", () => {
    it("should return null for invalid URL", async () => {
      const result = await downloadCover("not-a-url");
      expect(result).toBeNull();
    });

    it("should return null for empty string URL", async () => {
      const result = await downloadCover("");
      expect(result).toBeNull();
    });

    it("should return null for ftp:// protocol", async () => {
      const result = await downloadCover("ftp://example.com/cover.jpg");
      expect(result).toBeNull();
    });

    it("should return null for file:// protocol", async () => {
      const result = await downloadCover("file:///etc/passwd");
      expect(result).toBeNull();
    });

    it("should return null for data: URLs", async () => {
      const result = await downloadCover("data:image/png;base64,abc");
      expect(result).toBeNull();
    });
  });

  describe("HTTP response handling", () => {
    it("should return null for non-OK response", async () => {
      setMockFetchResolved(mockResponse({ ok: false, status: 404 }));
      const result = await downloadCover("https://example.com/cover.jpg");
      expect(result).toBeNull();
    });

    it("should return null for 500 response", async () => {
      setMockFetchResolved(mockResponse({ ok: false, status: 500 }));
      const result = await downloadCover("https://example.com/cover.jpg");
      expect(result).toBeNull();
    });

    it("should return null when Content-Length exceeds maximum", async () => {
      const headers = new Headers();
      headers.set("content-length", "999999999");
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers }));
      const result = await downloadCover("https://example.com/cover.jpg");
      expect(result).toBeNull();
    });

    it("should return null for empty response body", async () => {
      const headers = new Headers();
      headers.set("content-type", "image/jpeg");
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: Buffer.alloc(0) }));
      const result = await downloadCover("https://example.com/cover.jpg");
      expect(result).toBeNull();
    });

    it("should return null when fetch throws a network error", async () => {
      setMockFetchRejected(new Error("Network error"));
      const result = await downloadCover("https://example.com/cover.jpg");
      expect(result).toBeNull();
    });

    it("should return null when fetch times out (AbortError)", async () => {
      const abortError = new DOMException("The operation was aborted", "AbortError");
      setMockFetchRejected(abortError);
      const result = await downloadCover("https://example.com/cover.jpg");
      expect(result).toBeNull();
    });
  });

  describe("MIME type detection", () => {
    it("should detect JPEG from Content-Type header", async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const headers = new Headers();
      headers.set("content-type", "image/jpeg");
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: jpegBuffer }));

      const result = await downloadCover("https://example.com/cover.jpg");
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("image/jpeg");
    });

    it("should detect PNG from Content-Type header", async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const headers = new Headers();
      headers.set("content-type", "image/png");
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: pngBuffer }));

      const result = await downloadCover("https://example.com/cover.png");
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("image/png");
    });

    it("should fall back to magic bytes when Content-Type is application/octet-stream", async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const headers = new Headers();
      headers.set("content-type", "application/octet-stream");
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: jpegBuffer }));

      const result = await downloadCover("https://example.com/cover");
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("image/jpeg");
    });

    it("should detect PNG from magic bytes when no Content-Type", async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      setMockFetchResolved(mockResponse({ ok: true, status: 200, body: pngBuffer }));

      const result = await downloadCover("https://example.com/cover");
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("image/png");
    });

    it("should detect GIF from magic bytes", async () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      const headers = new Headers();
      headers.set("content-type", "application/octet-stream");
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: gifBuffer }));

      const result = await downloadCover("https://example.com/image.gif");
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("image/gif");
    });

    it("should detect WebP from magic bytes", async () => {
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
        0x00, 0x00,
      ]);
      setMockFetchResolved(mockResponse({ ok: true, status: 200, body: webpBuffer }));

      const result = await downloadCover("https://example.com/image.webp");
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("image/webp");
    });

    it("should return null for unsupported image format", async () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const headers = new Headers();
      headers.set("content-type", "image/bmp");
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: unknownBuffer }));

      const result = await downloadCover("https://example.com/image.bmp");
      expect(result).toBeNull();
    });

    it("should return null for buffer too small for magic byte detection", async () => {
      const tinyBuffer = Buffer.from([0x00, 0x01]);
      setMockFetchResolved(mockResponse({ ok: true, status: 200, body: tinyBuffer }));

      const result = await downloadCover("https://example.com/image");
      expect(result).toBeNull();
    });
  });

  describe("successful download", () => {
    it("should return buffer and mimeType for valid JPEG download", async () => {
      const jpegData = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      const headers = new Headers();
      headers.set("content-type", "image/jpeg");
      headers.set("content-length", jpegData.length.toString());
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: jpegData }));

      const result = await downloadCover("https://example.com/cover.jpg");

      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("image/jpeg");
      expect(result!.buffer).toBeInstanceOf(Buffer);
      expect(result!.buffer.length).toBe(jpegData.length);
    });

    it("should handle Content-Type with charset parameter", async () => {
      const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const headers = new Headers();
      headers.set("content-type", "image/png; charset=utf-8");
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: pngData }));

      const result = await downloadCover("https://example.com/cover.png");
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("image/png");
    });

    it("should accept both http and https URLs", async () => {
      const jpegData = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const headers = new Headers();
      headers.set("content-type", "image/jpeg");
      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: jpegData }));

      const resultHttp = await downloadCover("http://example.com/cover.jpg");
      expect(resultHttp).not.toBeNull();

      const resultHttps = await downloadCover("https://example.com/cover.jpg");
      expect(resultHttps).not.toBeNull();
    });
  });

  describe("size validation", () => {
    it("should reject downloads that exceed maximum size after download", async () => {
      const headers = new Headers();
      headers.set("content-type", "image/jpeg");

      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      oversizedBuffer[0] = 0xFF;
      oversizedBuffer[1] = 0xD8;
      oversizedBuffer[2] = 0xFF;

      setMockFetchResolved(mockResponse({ ok: true, status: 200, headers, body: oversizedBuffer }));

      const result = await downloadCover("https://example.com/huge-cover.jpg");
      expect(result).toBeNull();
    });
  });
});
