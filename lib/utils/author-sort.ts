/**
 * Generate author sort value from authors array.
 * Follows library science conventions for alphabetical sorting by surname.
 *
 * Handles common edge cases:
 * - Suffixes (Jr., Sr., III, etc.) → "LastName, FirstName Jr."
 * - Prefixes (van, de, von, etc.) → "Prefix LastName, FirstName"
 * - Single names (Plato, Madonna) → "Plato"
 * - Hyphenated names → treated as single unit
 *
 * @param authors - Array of author names
 * @returns Sort value or null if no valid authors
 *
 * @example
 * generateAuthorSort(["Brandon Sanderson"]) // "Sanderson, Brandon"
 * generateAuthorSort(["Walter M. Miller Jr."]) // "Miller, Walter M. Jr."
 * generateAuthorSort(["Ursula K. Le Guin"]) // "Le Guin, Ursula K."
 * generateAuthorSort(["Vincent van Gogh"]) // "van Gogh, Vincent"
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

  // Detect suffixes (Jr., Sr., III, IV, etc.)
  const suffixes = new Set([
    'Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III', 'IV', 'V',
    'M.D.', 'M.D', 'PhD', 'Ph.D.', 'Ph.D', 'Esq.', 'Esq'
  ]);
  
  const lastPart = parts[parts.length - 1];
  const hasSuffix = suffixes.has(lastPart);

  // Detect name prefixes (lowercase words that are part of surname)
  // Common in Dutch (van), German (von), French (de), Spanish (de la), etc.
  const prefixes = new Set([
    'van', 'von', 'de', 'del', 'della', 'da', 'di',
    'le', 'la', 'du', 'des', 'den', 'der', 'ten', 'ter',
  ]);
  
  // Two-word prefixes that should be checked as a unit
  const twoWordPrefixes = new Set([
    'van der', 'van den', 'van de', 'de la', 'de las', 'de los'
  ]);

  let surnameStartIndex = -1;
  let suffix = '';

  if (hasSuffix) {
    // "Walter M. Miller Jr." → surname is "Miller", suffix is "Jr."
    suffix = ` ${lastPart}`;
    surnameStartIndex = parts.length - 2;
  } else {
    surnameStartIndex = parts.length - 1;
  }

  // Check for prefixes before the surname  
  // Scan backward to find where the surname (including any prefixes) starts
  let actualSurnameStart = surnameStartIndex;
  
  while (actualSurnameStart > 0) {
    const i = actualSurnameStart - 1;
    const currentWord = parts[i];
    let foundPrefix = false;
    
    // Check if current word + the word that follows it forms a two-word prefix
    // (e.g., at position 1 "de", check "de las")
    if (i + 1 < parts.length) {
      const nextWord = parts[i + 1];
      const twoWords = `${currentWord} ${nextWord}`.toLowerCase();
      if (twoWordPrefixes.has(twoWords)) {
        actualSurnameStart = i;
        foundPrefix = true;
      }
    }
    
    // Check if current word is a single-word prefix
    if (!foundPrefix && prefixes.has(currentWord.toLowerCase())) {
      actualSurnameStart = i;
      foundPrefix = true;
    }
    
    // Special case: Check if the previous word + current word forms a two-word prefix
    // This handles cases like "de las Casas" where we're currently at "las"
    if (!foundPrefix && i > 0) {
      const prevWord = parts[i - 1];
      const twoWords = `${prevWord} ${currentWord}`.toLowerCase();
      if (twoWordPrefixes.has(twoWords)) {
        // The two-word prefix starts at i-1, so include both words
        actualSurnameStart = i - 1;
        foundPrefix = true;
      }
    }
    
    if (!foundPrefix) {
      break;
    }
  }

  // Build components
  const givenNames = parts.slice(0, actualSurnameStart).join(' ');
  const surname = parts.slice(actualSurnameStart, surnameStartIndex + 1).join(' ');

  // Format: "Surname, GivenNames Suffix"
  return `${surname}, ${givenNames}${suffix}`;
}
