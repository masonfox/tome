/**
 * Extract the last name from an author's full name.
 * Handles common cases like "Brandon Sanderson" -> "sanderson",
 * single names like "Plato" -> "plato", and empty/null values.
 *
 * @param authorName - Full author name (e.g., "Brandon Sanderson")
 * @returns Last name in lowercase for sorting
 */
export function extractLastName(authorName: string | null | undefined): string {
  if (!authorName || typeof authorName !== 'string') {
    return '';
  }

  const trimmed = authorName.trim();
  if (!trimmed) {
    return '';
  }

  // Split by whitespace and get the last word
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}
