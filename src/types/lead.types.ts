/**
 * Lead data models and configuration types for Google Maps Lead Generation CLI
 */

export interface BusinessLead {
  placeId: string;
  businessName: string;
  category?: string;
  primaryType?: string;
  types?: string[];
  phoneNumber?: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  website?: string;
  googleMapsUrl?: string;
  googleRating?: number | null;
  totalReviews?: number | null;
  businessStatus?: string;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: string[];
  isOpenNow?: boolean | null;
  collectedAt: string;
  locationQuery?: string;
  categoryQuery?: string;
}

export type LeadFieldKey =
  | 'businessName'
  | 'category'
  | 'phoneNumber'
  | 'fullAddress'
  | 'city'
  | 'state'
  | 'pincode'
  | 'website'
  | 'googleMapsUrl'
  | 'googleRating'
  | 'totalReviews'
  | 'businessStatus'
  | 'coordinates'
  | 'openingHours';

export interface LeadQualityFilters {
  minRating?: number;
  minReviews?: number;
  mustHavePhone?: boolean;
  mustHaveWebsite?: boolean;
  operationalOnly?: boolean;
}

export type OutputFormat = 'excel' | 'csv' | 'both';

export interface SearchCriteria {
  id?: string;
  name?: string;
  locations: string[];
  categories: string[];
  radiusKm: number;
  targetLeads: number;
  fields: LeadFieldKey[];
  filters: LeadQualityFilters;
  outputFormat: OutputFormat;
  combineMultiLocations?: boolean;
  createdAt?: string;
}

export interface SearchProgressStats {
  locationIndex: number;
  totalLocations: number;
  currentLocation: string;
  categoryIndex: number;
  totalCategories: number;
  currentCategory: string;
  targetLeads: number;
  totalFound: number;
  uniqueLeads: number;
  duplicatesRemoved: number;
  phoneNumbersFound: number;
  websitesFound: number;
  filteredOut: number;
  statusMessage: string;
  percent: number;
}

export interface SearchHistoryEntry {
  id: string;
  timestamp: string;
  criteria: SearchCriteria;
  resultsCount: number;
  outputFiles: string[];
  durationMs: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedLocation {
  formattedAddress: string;
  coordinates: Coordinates;
  locality?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}
