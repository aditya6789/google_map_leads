import fs from 'node:fs';
import path from 'node:path';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function sanitizeFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // remove non-alphanumeric except spaces, hyphens, underscores
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export function formatDateForFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

/**
 * Ensures an output file path does not overwrite existing files.
 * If file exists, appends _1, _2, etc.
 */
export function getUniqueFilePath(fullPath: string): string {
  if (!fs.existsSync(fullPath)) {
    return fullPath;
  }

  const dir = path.dirname(fullPath);
  const ext = path.extname(fullPath);
  const base = path.basename(fullPath, ext);

  let counter = 1;
  while (true) {
    const candidate = path.join(dir, `${base}_${counter}${ext}`);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
    counter++;
  }
}

/**
 * Normalizes a phone number for duplicate detection.
 * Strips formatting, spaces, dashes, parentheses.
 * Retains only digits, and normalizes national vs international prefixes (e.g. leading 0 or +91 for 10-digit numbers).
 */
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  // Extract all digits
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // If ends with 10 digits (common for mobile/landline numbers without country code), extract the last 10 digits
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Normalizes business name for deduplication.
 */
export function normalizeBusinessName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes address for deduplication.
 */
export function normalizeAddress(address?: string | null): string {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits comma-separated user inputs into trimmed non-empty array
 */
export function parseCommaSeparatedList(input: string): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Truncates text with ellipsis if length exceeds max
 */
export function truncate(text: string, maxLen = 30): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}
