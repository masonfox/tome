/**
 * Application-wide constants
 * 
 * Centralizes magic numbers and configuration values for better maintainability.
 * When updating these values, ensure they align with system constraints and performance requirements.
 */

/**
 * API Request Limits
 * 
 * Prevent DoS attacks and ensure reasonable API response times
 */
export const API_LIMITS = {
  /** Maximum number of journal entries per API request */
  MAX_JOURNAL_ENTRIES_PER_REQUEST: 200,
  
  /** Maximum number of books per library API request */
  MAX_BOOKS_PER_REQUEST: 200,
  
  /** Default page size for paginated endpoints */
  DEFAULT_PAGE_SIZE: 50,
} as const;

/**
 * Input Validation Limits
 * 
 * Prevent excessively large inputs that could cause performance issues
 */
export const VALIDATION_LIMITS = {
  /** Maximum length for series names (characters) */
  MAX_SERIES_NAME_LENGTH: 500,
  
  /** Maximum length for book titles (characters) */
  MAX_BOOK_TITLE_LENGTH: 1000,
  
  /** Maximum length for notes/reviews (characters) */
  MAX_NOTE_LENGTH: 10000,
  
  /** Maximum length for tag names (characters) */
  MAX_TAG_LENGTH: 100,
} as const;

/**
 * Cache Configuration
 * 
 * In-memory cache settings for cover images and metadata
 */
export const CACHE_CONFIG = {
  /** Cover Image Cache */
  COVER_CACHE: {
    /** Maximum number of cover images to cache in memory */
    MAX_SIZE: 500,
    
    /** Cache entry TTL in milliseconds (24 hours) */
    MAX_AGE_MS: 1000 * 60 * 60 * 24,
  },
  
  /** Book Path Cache (for cover lookups) */
  BOOK_PATH_CACHE: {
    /** Maximum number of book paths to cache */
    MAX_SIZE: 1000,
    
    /** Cache entry TTL in milliseconds (1 hour) */
    MAX_AGE_MS: 1000 * 60 * 60,
  },
} as const;

/**
 * Time Constants
 * 
 * Common time durations in milliseconds for consistency
 */
export const TIME_MS = {
  SECOND: 1000,
  MINUTE: 1000 * 60,
  HOUR: 1000 * 60 * 60,
  DAY: 1000 * 60 * 60 * 24,
  WEEK: 1000 * 60 * 60 * 24 * 7,
} as const;

/**
 * Database Limits
 * 
 * Constraints enforced at the application layer (in addition to DB constraints)
 */
export const DATABASE_LIMITS = {
  /** Minimum year for reading goals and date fields */
  MIN_YEAR: 1900,
  
  /** Maximum year for reading goals and date fields */
  MAX_YEAR: 9999,
  
  /** Minimum books goal for annual reading goals */
  MIN_BOOKS_GOAL: 1,
  
  /** Maximum books goal for annual reading goals */
  MAX_BOOKS_GOAL: 9999,
  
  /** Maximum length for shelf names (characters) */
  SHELF_NAME_MAX_LENGTH: 100,
} as const;

/**
 * Business Logic Constants
 * 
 * Domain-specific thresholds and limits
 */
export const BUSINESS_RULES = {
  /** Progress percentage considered "complete" (triggers completion modal) */
  COMPLETION_THRESHOLD_PERCENTAGE: 100,
  
  /** Minimum pages for a valid book */
  MIN_BOOK_PAGES: 1,
  
  /** Maximum days of inactivity before streak resets */
  MAX_STREAK_MISS_DAYS: 1,
} as const;
