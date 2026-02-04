/**
 * OPDS Feed Generator
 * Generates OPDS 1.2 compliant Atom XML feeds
 */

import type { OPDSFeed, OPDSEntry, OPDSLink, OPDSAuthor, OPDSCategory } from './types';
import { OPDS_NAMESPACES } from './constants';

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate XML for an OPDS link
 */
function generateLink(link: OPDSLink): string {
  const attrs = [
    `rel="${escapeXml(link.rel)}"`,
    `href="${escapeXml(link.href)}"`,
    `type="${escapeXml(link.type)}"`,
  ];

  if (link.title) {
    attrs.push(`title="${escapeXml(link.title)}"`);
  }

  if (link.count !== undefined) {
    attrs.push(`thr:count="${link.count}"`);
  }

  return `<link ${attrs.join(' ')} />`;
}

/**
 * Generate XML for an OPDS author
 */
function generateAuthor(author: OPDSAuthor): string {
  const parts = [`<name>${escapeXml(author.name)}</name>`];

  if (author.uri) {
    parts.push(`<uri>${escapeXml(author.uri)}</uri>`);
  }

  return `<author>${parts.join('')}</author>`;
}

/**
 * Generate XML for an OPDS category
 */
function generateCategory(category: OPDSCategory): string {
  const attrs = [
    `term="${escapeXml(category.term)}"`,
    `label="${escapeXml(category.label)}"`,
  ];

  if (category.scheme) {
    attrs.push(`scheme="${escapeXml(category.scheme)}"`);
  }

  return `<category ${attrs.join(' ')} />`;
}

/**
 * Generate XML for an OPDS entry
 */
function generateEntry(entry: OPDSEntry): string {
  const parts: string[] = [
    '<entry>',
    `<title>${escapeXml(entry.title)}</title>`,
    `<id>${escapeXml(entry.id)}</id>`,
    `<updated>${entry.updated}</updated>`,
  ];

  // Authors
  entry.authors.forEach(author => {
    parts.push(generateAuthor(author));
  });

  // Links
  entry.links.forEach(link => {
    parts.push(generateLink(link));
  });

  // Content
  if (entry.content) {
    parts.push(`<content type="${escapeXml(entry.content.type)}">${escapeXml(entry.content.text)}</content>`);
  }

  // Summary
  if (entry.summary) {
    parts.push(`<summary>${escapeXml(entry.summary)}</summary>`);
  }

  // Published date
  if (entry.published) {
    parts.push(`<published>${entry.published}</published>`);
  }

  // Categories
  if (entry.categories) {
    entry.categories.forEach(category => {
      parts.push(generateCategory(category));
    });
  }

  // Dublin Core terms
  if (entry.dcterms) {
    if (entry.dcterms.publisher) {
      parts.push(`<dcterms:publisher>${escapeXml(entry.dcterms.publisher)}</dcterms:publisher>`);
    }
    if (entry.dcterms.language) {
      parts.push(`<dcterms:language>${escapeXml(entry.dcterms.language)}</dcterms:language>`);
    }
    if (entry.dcterms.issued) {
      parts.push(`<dcterms:issued>${entry.dcterms.issued}</dcterms:issued>`);
    }
    if (entry.dcterms.identifier) {
      parts.push(`<dcterms:identifier>${escapeXml(entry.dcterms.identifier)}</dcterms:identifier>`);
    }
  }

  parts.push('</entry>');
  return parts.join('\n  ');
}

/**
 * Generate OPDS navigation feed
 */
export function generateNavigationFeed(feed: OPDSFeed): string {
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<feed xmlns="${OPDS_NAMESPACES.ATOM}"`,
    `      xmlns:dcterms="${OPDS_NAMESPACES.DC}"`,
    `      xmlns:opds="${OPDS_NAMESPACES.OPDS}"`,
    `      xmlns:thr="${OPDS_NAMESPACES.THREAD}">`,
    `<id>${escapeXml(feed.id)}</id>`,
    `<title>${escapeXml(feed.title)}</title>`,
    `<updated>${feed.updated}</updated>`,
  ];

  // Author
  if (feed.author) {
    parts.push(generateAuthor(feed.author));
  }

  // Subtitle
  if (feed.subtitle) {
    parts.push(`<subtitle>${escapeXml(feed.subtitle)}</subtitle>`);
  }

  // Icon
  if (feed.icon) {
    parts.push(`<icon>${escapeXml(feed.icon)}</icon>`);
  }

  // Links
  feed.links.forEach(link => {
    parts.push(generateLink(link));
  });

  // Entries
  feed.entries.forEach(entry => {
    parts.push(generateEntry(entry));
  });

  parts.push('</feed>');
  return parts.join('\n');
}

/**
 * Generate OPDS acquisition feed
 */
export function generateAcquisitionFeed(feed: OPDSFeed): string {
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<feed xmlns="${OPDS_NAMESPACES.ATOM}"`,
    `      xmlns:dcterms="${OPDS_NAMESPACES.DC}"`,
    `      xmlns:opds="${OPDS_NAMESPACES.OPDS}"`,
    `      xmlns:opensearch="${OPDS_NAMESPACES.OPENSEARCH}">`,
    `<id>${escapeXml(feed.id)}</id>`,
    `<title>${escapeXml(feed.title)}</title>`,
    `<updated>${feed.updated}</updated>`,
  ];

  // Author
  if (feed.author) {
    parts.push(generateAuthor(feed.author));
  }

  // Subtitle
  if (feed.subtitle) {
    parts.push(`<subtitle>${escapeXml(feed.subtitle)}</subtitle>`);
  }

  // Icon
  if (feed.icon) {
    parts.push(`<icon>${escapeXml(feed.icon)}</icon>`);
  }

  // OpenSearch elements (for pagination)
  if (feed.totalResults !== undefined) {
    parts.push(`<opensearch:totalResults>${feed.totalResults}</opensearch:totalResults>`);
  }
  if (feed.itemsPerPage !== undefined) {
    parts.push(`<opensearch:itemsPerPage>${feed.itemsPerPage}</opensearch:itemsPerPage>`);
  }
  if (feed.startIndex !== undefined) {
    parts.push(`<opensearch:startIndex>${feed.startIndex}</opensearch:startIndex>`);
  }

  // Links
  feed.links.forEach(link => {
    parts.push(generateLink(link));
  });

  // Entries
  feed.entries.forEach(entry => {
    parts.push(generateEntry(entry));
  });

  parts.push('</feed>');
  return parts.join('\n');
}
