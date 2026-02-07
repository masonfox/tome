/**
 * OPDS (Open Publication Distribution System) Type Definitions
 * Based on OPDS 1.2 specification
 */

export interface OPDSLink {
  rel: string;
  href: string;
  type: string;
  title?: string;
  count?: number;
}

export interface OPDSAuthor {
  name: string;
  uri?: string;
}

export interface OPDSCategory {
  term: string;
  label: string;
  scheme?: string;
}

export interface OPDSContent {
  type: string;
  text: string;
}

export interface OPDSDCTerms {
  publisher?: string;
  language?: string;
  issued?: string;
  identifier?: string;
}

export interface OPDSEntry {
  id: string;
  title: string;
  updated: string;
  authors: OPDSAuthor[];
  content?: OPDSContent;
  links: OPDSLink[];
  categories?: OPDSCategory[];
  published?: string;
  summary?: string;
  dcterms?: OPDSDCTerms;
}

export interface OPDSFeed {
  id: string;
  title: string;
  updated: string;
  entries: OPDSEntry[];
  links: OPDSLink[];
  author?: OPDSAuthor;
  subtitle?: string;
  icon?: string;
  totalResults?: number;
  itemsPerPage?: number;
  startIndex?: number;
}
