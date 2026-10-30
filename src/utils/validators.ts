export function validateLeadCount(input: string | number): boolean | string {
  const num = typeof input === 'number' ? input : parseInt(input.trim(), 10);
  if (isNaN(num) || num <= 0) {
    return 'Please enter a valid positive number of leads (e.g. 50, 100).';
  }
  if (num > 1000) {
    return 'Lead count is capped at 1,000 per search to avoid excessive API costs and timeouts.';
  }
  return true;
}

export function validateRadius(input: string | number): boolean | string {
  const num = typeof input === 'number' ? input : parseFloat(input.trim());
  if (isNaN(num) || num <= 0) {
    return 'Please enter a valid positive radius in kilometers (e.g. 5, 10).';
  }
  if (num > 50) {
    return 'Maximum search radius is 50 KM (Google Places API limit).';
  }
  return true;
}

export function validateLocation(input: string): boolean | string {
  const trimmed = input.trim();
  if (trimmed.length < 2) {
    return 'Please enter a valid location (e.g. "Janakpuri, Delhi, India").';
  }
  return true;
}

export function validateCategory(input: string): boolean | string {
  const trimmed = input.trim();
  if (trimmed.length < 2) {
    return 'Please enter at least one business category.';
  }
  return true;
}

export function isProbableGoogleApiKey(key: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  // Standard Google Cloud API keys start with AIza and are 39 chars
  return /^AIza[0-9A-Za-z-_]{35}$/.test(trimmed) || trimmed.length >= 25;
}
