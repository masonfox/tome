import { describe, it, expect } from "vitest";
import { generateAuthorSort } from "@/lib/utils/author-sort";

describe("generateAuthorSort", () => {
  it("should handle standard two-word names", () => {
    expect(generateAuthorSort(["Brandon Sanderson"])).toBe(
      "Sanderson, Brandon"
    );
    expect(generateAuthorSort(["Robert Jordan"])).toBe("Jordan, Robert");
  });

  it("should handle three-word names", () => {
    expect(generateAuthorSort(["Ursula K. Le Guin"])).toBe(
      "Guin, Ursula K. Le"
    );
    expect(generateAuthorSort(["J.R.R. Tolkien"])).toBe("Tolkien, J.R.R.");
  });

  it("should handle single names", () => {
    expect(generateAuthorSort(["Plato"])).toBe("Plato");
    expect(generateAuthorSort(["Madonna"])).toBe("Madonna");
  });

  it("should handle empty arrays", () => {
    expect(generateAuthorSort([])).toBeNull();
  });

  it("should handle null/undefined", () => {
    expect(generateAuthorSort(null as any)).toBeNull();
    expect(generateAuthorSort(undefined as any)).toBeNull();
  });

  it("should use only first author", () => {
    expect(generateAuthorSort(["Brandon Sanderson", "Robert Jordan"])).toBe(
      "Sanderson, Brandon"
    );
  });

  it("should handle whitespace", () => {
    expect(generateAuthorSort(["  Brandon   Sanderson  "])).toBe(
      "Sanderson, Brandon"
    );
  });

  it("should handle initials", () => {
    expect(generateAuthorSort(["N.K. Jemisin"])).toBe("Jemisin, N.K.");
  });

  it("should handle empty string in array", () => {
    expect(generateAuthorSort([""])).toBeNull();
    expect(generateAuthorSort(["   "])).toBeNull();
  });

  it("should handle four-word names", () => {
    expect(generateAuthorSort(["Patrick M. De La Grange"])).toBe(
      "Grange, Patrick M. De La"
    );
  });
});
