/**
 * Generate author sort value from authors array.
 * Follows Calibre convention: "LastName, FirstName MiddleNames"
 *
 * @param authors - Array of author names
 * @returns Sort value or null if no valid authors
 *
 * @example
 * generateAuthorSort(["Brandon Sanderson"]) // "Sanderson, Brandon"
 * generateAuthorSort(["Ursula K. Le Guin"]) // "Guin, Ursula K. Le"
 * generateAuthorSort(["Plato"]) // "Plato"
 * generateAuthorSort([]) // null
 */
export function generateAuthorSort(authors: string[]): string | null {
  // Handle empty authors array
  if (!authors || authors.length === 0) {
    return null;
  }

  // Use first author only (Calibre pattern)
  const firstAuthor = authors[0].trim();

  if (!firstAuthor) {
    return null;
  }

  // Single name (e.g., "Plato", "Madonna")
  const parts = firstAuthor.split(/\s+/);
  if (parts.length === 1) {
    return firstAuthor; // "Plato" → "Plato"
  }

  // Multi-word name: "FirstName MiddleNames LastName"
  // Extract: last word = last name, rest = first/middle names
  const lastName = parts[parts.length - 1];
  const firstAndMiddle = parts.slice(0, -1).join(" ");

  // Format: "LastName, FirstName MiddleNames"
  return `${lastName}, ${firstAndMiddle}`;
}
