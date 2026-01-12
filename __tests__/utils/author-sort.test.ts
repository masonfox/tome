import { describe, it, expect } from "vitest";
import { generateAuthorSort } from "@/lib/utils/author-sort";

describe("generateAuthorSort", () => {
  describe("Basic names", () => {
    it("should handle standard two-word names", () => {
      expect(generateAuthorSort(["Brandon Sanderson"])).toBe(
        "Sanderson, Brandon"
      );
      expect(generateAuthorSort(["Robert Jordan"])).toBe("Jordan, Robert");
    });

    it("should handle three-word names with middle initial", () => {
      expect(generateAuthorSort(["J.R.R. Tolkien"])).toBe("Tolkien, J.R.R.");
      expect(generateAuthorSort(["N.K. Jemisin"])).toBe("Jemisin, N.K.");
    });

    it("should handle single names", () => {
      expect(generateAuthorSort(["Plato"])).toBe("Plato");
      expect(generateAuthorSort(["Madonna"])).toBe("Madonna");
    });
  });

  describe("Name prefixes", () => {
    it("should handle Dutch prefixes (van, van der, van den)", () => {
      expect(generateAuthorSort(["Vincent van Gogh"])).toBe(
        "van Gogh, Vincent"
      );
      expect(generateAuthorSort(["Bessel van der Kolk"])).toBe(
        "van der Kolk, Bessel"
      );
      expect(generateAuthorSort(["Johannes van den Berg"])).toBe(
        "van den Berg, Johannes"
      );
    });

    it("should handle German prefixes (von)", () => {
      expect(generateAuthorSort(["Alexander von Humboldt"])).toBe(
        "von Humboldt, Alexander"
      );
    });

    it("should handle French prefixes (de, le, la, du)", () => {
      expect(generateAuthorSort(["Honoré de Balzac"])).toBe(
        "de Balzac, Honoré"
      );
      expect(generateAuthorSort(["Ursula K. Le Guin"])).toBe(
        "Le Guin, Ursula K."
      );
      expect(generateAuthorSort(["Guy de Maupassant"])).toBe(
        "de Maupassant, Guy"
      );
    });

    it("should handle Spanish/Italian prefixes (del, della, di, da)", () => {
      expect(generateAuthorSort(["Leonardo da Vinci"])).toBe(
        "da Vinci, Leonardo"
      );
      expect(generateAuthorSort(["Miguel de Cervantes"])).toBe(
        "de Cervantes, Miguel"
      );
    });

    it("should handle complex multi-word prefixes (de la, de las)", () => {
      expect(generateAuthorSort(["Bartolomé de las Casas"])).toBe(
        "de las Casas, Bartolomé"
      );
    });
  });

  describe("Name suffixes", () => {
    it("should handle Jr. and Sr. suffixes", () => {
      expect(generateAuthorSort(["Walter M. Miller Jr."])).toBe(
        "Miller, Walter M. Jr."
      );
      expect(generateAuthorSort(["Martin Luther King Jr."])).toBe(
        "King, Martin Luther Jr."
      );
      expect(generateAuthorSort(["Sammy Davis Sr."])).toBe(
        "Davis, Sammy Sr."
      );
    });

    it("should handle Roman numeral suffixes", () => {
      expect(generateAuthorSort(["William Gates III"])).toBe(
        "Gates, William III"
      );
      expect(generateAuthorSort(["Henry Ford II"])).toBe("Ford, Henry II");
      expect(generateAuthorSort(["Pope John Paul IV"])).toBe(
        "Paul, Pope John IV"
      );
    });

    it("should handle professional suffixes", () => {
      expect(generateAuthorSort(["Jane Smith M.D."])).toBe(
        "Smith, Jane M.D."
      );
      expect(generateAuthorSort(["John Doe Ph.D."])).toBe("Doe, John Ph.D.");
    });
  });

  describe("Complex combinations", () => {
    it("should handle prefixes with suffixes", () => {
      expect(generateAuthorSort(["Ludwig van Beethoven Jr."])).toBe(
        "van Beethoven, Ludwig Jr."
      );
    });

    it("should handle prefixes with middle names", () => {
      expect(generateAuthorSort(["Johann Sebastian von Bach"])).toBe(
        "von Bach, Johann Sebastian"
      );
    });

    it("should handle hyphenated surnames", () => {
      expect(generateAuthorSort(["Arthur Conan-Doyle"])).toBe(
        "Conan-Doyle, Arthur"
      );
      expect(generateAuthorSort(["Jean-Paul Sartre"])).toBe(
        "Sartre, Jean-Paul"
      );
    });
  });

  describe("Edge cases", () => {
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

    it("should handle excessive whitespace", () => {
      expect(generateAuthorSort(["  Brandon   Sanderson  "])).toBe(
        "Sanderson, Brandon"
      );
    });

    it("should handle empty string in array", () => {
      expect(generateAuthorSort([""])).toBeNull();
      expect(generateAuthorSort(["   "])).toBeNull();
    });
  });

  describe("Real-world examples from Calibre", () => {
    it("should match Calibre's sorting for common authors", () => {
      expect(generateAuthorSort(["Sönke Ahrens"])).toBe("Ahrens, Sönke");
      expect(generateAuthorSort(["Jeff Goins"])).toBe("Goins, Jeff");
      expect(generateAuthorSort(["Lao Tzu"])).toBe("Tzu, Lao");
      expect(generateAuthorSort(["Patrick M. Lencioni"])).toBe(
        "Lencioni, Patrick M."
      );
    });
  });
});
