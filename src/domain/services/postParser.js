/**
 * @fileoverview Post Parser
 * Extracts report fields from channel post text.
 * @module domain/services/postParser
 */

/**
 * Extra report columns produced by parsePost, in display order.
 * Example: [{ key: 'price', header: 'Narx' }]
 */
export const PARSED_COLUMNS = [];

/**
 * Extracts fields from post text for report.
 * TODO: rules will be defined later. Must return values for keys in PARSED_COLUMNS.
 * @param {string|null} text - Post text
 * @returns {Object} Parsed fields { [key]: value }
 */
export function parsePost(text) {
  return {};
}
