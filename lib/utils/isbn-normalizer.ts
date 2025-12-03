/**
 * ISBN normalization utilities
 * Handles cleaning and conversion between ISBN-10 and ISBN-13 formats
 */

/**
 * Remove all non-digit characters except 'X' (valid in ISBN-10)
 */
export function cleanISBN(isbn: string | null | undefined): string | null {
  if (!isbn) return null;
  
  const cleaned = isbn.toUpperCase().replace(/[^0-9X]/g, "");
  
  // ISBN-10: 10 characters (9 digits + check digit which can be X)
  // ISBN-13: 13 digits
  if (cleaned.length === 10 || cleaned.length === 13) {
    return cleaned;
  }
  
  return null;
}

/**
 * Validate ISBN-10 checksum
 */
export function isValidISBN10(isbn: string): boolean {
  if (isbn.length !== 10) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(isbn[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (10 - i);
  }
  
  // Last character can be 0-9 or X (representing 10)
  const checkChar = isbn[9];
  const checkDigit = checkChar === "X" ? 10 : parseInt(checkChar, 10);
  if (isNaN(checkDigit)) return false;
  
  sum += checkDigit;
  return sum % 11 === 0;
}

/**
 * Validate ISBN-13 checksum
 */
export function isValidISBN13(isbn: string): boolean {
  if (isbn.length !== 13) return false;
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(isbn[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  
  const checkDigit = parseInt(isbn[12], 10);
  if (isNaN(checkDigit)) return false;
  
  const calculatedCheck = (10 - (sum % 10)) % 10;
  return checkDigit === calculatedCheck;
}

/**
 * Convert ISBN-10 to ISBN-13
 * Prepends "978" and recalculates the check digit
 */
export function isbn10ToISBN13(isbn10: string): string | null {
  const cleaned = cleanISBN(isbn10);
  if (!cleaned || cleaned.length !== 10) return null;
  if (!isValidISBN10(cleaned)) return null;
  
  // Remove the ISBN-10 check digit and prepend 978
  const base = "978" + cleaned.substring(0, 9);
  
  // Calculate new ISBN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  
  return base + checkDigit;
}

/**
 * Normalize ISBN to ISBN-13 format if possible
 * Returns the cleaned ISBN-13, or the original cleaned ISBN if conversion fails
 */
export function normalizeISBN(isbn: string | null | undefined): string | null {
  const cleaned = cleanISBN(isbn);
  if (!cleaned) return null;
  
  if (cleaned.length === 13) {
    return isValidISBN13(cleaned) ? cleaned : null;
  }
  
  if (cleaned.length === 10) {
    // Try to convert to ISBN-13
    const isbn13 = isbn10ToISBN13(cleaned);
    if (isbn13) return isbn13;
    
    // If conversion fails but ISBN-10 is valid, return it
    return isValidISBN10(cleaned) ? cleaned : null;
  }
  
  return null;
}

/**
 * Compare two ISBNs for equality, normalizing both first
 */
export function isbnEquals(
  isbn1: string | null | undefined,
  isbn2: string | null | undefined
): boolean {
  const normalized1 = normalizeISBN(isbn1);
  const normalized2 = normalizeISBN(isbn2);
  
  if (!normalized1 || !normalized2) return false;
  
  // If both are ISBN-13, compare directly
  if (normalized1.length === 13 && normalized2.length === 13) {
    return normalized1 === normalized2;
  }
  
  // If one is ISBN-10 and the other is ISBN-13, try converting
  if (normalized1.length === 10 && normalized2.length === 13) {
    const converted = isbn10ToISBN13(normalized1);
    return converted === normalized2;
  }
  
  if (normalized1.length === 13 && normalized2.length === 10) {
    const converted = isbn10ToISBN13(normalized2);
    return converted === normalized1;
  }
  
  // Both ISBN-10
  return normalized1 === normalized2;
}

/**
 * Extract and normalize multiple ISBNs from a string
 * Useful for fields that might contain multiple ISBNs
 */
export function extractISBNs(text: string | null | undefined): string[] {
  if (!text) return [];
  
  const isbns: string[] = [];
  
  // Match potential ISBN-10 and ISBN-13 patterns
  const patterns = [
    /\b\d{13}\b/g, // ISBN-13
    /\b\d{9}[\dX]\b/g, // ISBN-10
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const normalized = normalizeISBN(match);
        if (normalized && !isbns.includes(normalized)) {
          isbns.push(normalized);
        }
      }
    }
  }
  
  return isbns;
}
