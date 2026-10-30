import axios, { AxiosError } from 'axios';
import { env, getApiKey } from '../config/env.js';
import { BusinessLead, Coordinates, LeadFieldKey } from '../types/lead.types.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/helpers.js';

export interface SearchPageResult {
  leads: BusinessLead[];
  nextPageToken?: string;
  totalReturnedThisPage: number;
}

export class GooglePlacesService {
  private static BASE_URL = 'https://places.googleapis.com/v1/places:searchText';

  /**
   * Validates the Google Places API Key with a small test request.
   */
  public static async validateApiKey(apiKeyToTest?: string): Promise<{ valid: boolean; error?: string }> {
    const key = apiKeyToTest || getApiKey();
    if (!key) {
      return { valid: false, error: 'No API key provided.' };
    }

    try {
      await axios.post(
        this.BASE_URL,
        {
          textQuery: 'Google',
          pageSize: 1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'places.id',
          },
          timeout: 8000,
        }
      );
      return { valid: true };
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { message?: string; status?: string; details?: unknown[] } }>;
      const status = axiosErr.response?.status;
      const apiMsg = axiosErr.response?.data?.error?.message;

      if (status === 400) {
        return { valid: false, error: `Invalid Request / API Key: ${apiMsg || axiosErr.message}` };
      }
      if (status === 403) {
        return {
          valid: false,
          error: `API Key permission denied (HTTP 403). Ensure "Places API (New)" is enabled in Google Cloud Console and billing is active.\nDetail: ${apiMsg || axiosErr.message}`,
        };
      }
      if (status === 429) {
        return { valid: false, error: 'API quota limit exceeded (HTTP 429).' };
      }

      return { valid: false, error: apiMsg || axiosErr.message || 'Unknown network error.' };
    }
  }

  /**
   * Builds the X-Goog-FieldMask header based on requested fields.
   */
  public static buildFieldMask(requestedFields?: LeadFieldKey[]): string {
    const fieldsSet = new Set<string>([
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.businessStatus',
      'places.googleMapsUri',
      'places.types',
      'places.primaryTypeDisplayName',
      'places.addressComponents',
      'nextPageToken',
    ]);

    if (!requestedFields || requestedFields.length === 0) {
      fieldsSet.add('places.nationalPhoneNumber');
      fieldsSet.add('places.internationalPhoneNumber');
      fieldsSet.add('places.websiteUri');
      fieldsSet.add('places.rating');
      fieldsSet.add('places.userRatingCount');
      fieldsSet.add('places.regularOpeningHours');
      return Array.from(fieldsSet).join(',');
    }

    if (requestedFields.includes('phoneNumber')) {
      fieldsSet.add('places.nationalPhoneNumber');
      fieldsSet.add('places.internationalPhoneNumber');
    }
    if (requestedFields.includes('website')) {
      fieldsSet.add('places.websiteUri');
    }
    if (requestedFields.includes('googleRating') || requestedFields.includes('totalReviews')) {
      fieldsSet.add('places.rating');
      fieldsSet.add('places.userRatingCount');
    }
    if (requestedFields.includes('openingHours')) {
      fieldsSet.add('places.regularOpeningHours');
    }

    return Array.from(fieldsSet).join(',');
  }

  /**
   * Searches places using Google Places API (New) Text Search.
   */
  public static async searchPlaces(params: {
    category: string;
    locationText: string;
    coordinates?: Coordinates;
    radiusMeters?: number;
    requestedFields?: LeadFieldKey[];
    pageToken?: string;
  }): Promise<SearchPageResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Google Maps API Key is missing. Please set it in .env or configure it.');
    }

    const { category, locationText, coordinates, radiusMeters, requestedFields, pageToken } = params;
    const query = `${category} in ${locationText}`;
    const fieldMask = this.buildFieldMask(requestedFields);

    const requestBody: Record<string, unknown> = {
      textQuery: query,
      pageSize: 20,
    };

    if (pageToken) {
      requestBody.pageToken = pageToken;
    }

    if (coordinates && radiusMeters && radiusMeters > 0) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          },
          radius: Math.min(radiusMeters, 50000), // Max radius 50km
        },
      };
    }

    const maxRetries = env.MAX_RETRIES;
    let delay = env.RETRY_DELAY_MS;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await axios.post(this.BASE_URL, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': fieldMask,
          },
          timeout: env.REQUEST_TIMEOUT_MS,
        });

        const rawPlaces = response.data?.places || [];
        const leads: BusinessLead[] = rawPlaces.map((p: any) =>
          this.mapPlaceToLead(p, category, locationText)
        );

        return {
          leads,
          nextPageToken: response.data?.nextPageToken,
          totalReturnedThisPage: leads.length,
        };
      } catch (err) {
        const axiosErr = err as AxiosError<{ error?: { message?: string; status?: string } }>;
        const status = axiosErr.response?.status;
        const errMsg = axiosErr.response?.data?.error?.message || axiosErr.message;

        logger.warn({ attempt, status, error: errMsg }, `Places search attempt ${attempt} failed`);

        if (status === 400 || status === 403) {
          throw new Error(`Google Places API Error (${status}): ${errMsg}`);
        }

        if (status === 429) {
          logger.warn('Rate limit hit. Waiting before retry...');
          await sleep(delay * 2);
        }

        if (attempt <= maxRetries) {
          await sleep(delay);
          delay *= 2;
        } else {
          throw new Error(`Google Places search failed for "${query}": ${errMsg}`);
        }
      }
    }

    throw new Error(`Failed to complete search for "${query}" after retries.`);
  }

  /**
   * Maps Google Places API (New) raw place item to BusinessLead format.
   */
  private static mapPlaceToLead(
    raw: any,
    categoryQuery: string,
    locationQuery: string
  ): BusinessLead {
    let city = '';
    let state = '';
    let pincode = '';
    let country = '';

    if (Array.isArray(raw.addressComponents)) {
      for (const comp of raw.addressComponents) {
        const types: string[] = comp.types || [];
        if (types.includes('locality')) {
          city = comp.longText || comp.shortText || '';
        } else if (!city && (types.includes('sublocality_level_1') || types.includes('sublocality'))) {
          city = comp.longText || comp.shortText || '';
        }

        if (types.includes('administrative_area_level_1')) {
          state = comp.longText || comp.shortText || '';
        }
        if (types.includes('postal_code')) {
          pincode = comp.longText || comp.shortText || '';
        }
        if (types.includes('country')) {
          country = comp.longText || comp.shortText || '';
        }
      }
    }

    const businessName = raw.displayName?.text || 'Unknown Business';
    const primaryType = raw.primaryTypeDisplayName?.text || (raw.types && raw.types[0]) || '';
    const phone = raw.nationalPhoneNumber || raw.internationalPhoneNumber || '';
    const mapsUrl =
      raw.googleMapsUri ||
      (raw.id ? `https://www.google.com/maps/place/?q=place_id:${raw.id}` : '');

    return {
      placeId: raw.id || '',
      businessName,
      category: primaryType || categoryQuery,
      primaryType,
      types: Array.isArray(raw.types) ? raw.types : [],
      phoneNumber: phone,
      fullAddress: raw.formattedAddress || '',
      city,
      state,
      pincode,
      country,
      website: raw.websiteUri || '',
      googleMapsUrl: mapsUrl,
      googleRating: typeof raw.rating === 'number' ? raw.rating : null,
      totalReviews: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : null,
      businessStatus: raw.businessStatus || 'OPERATIONAL',
      latitude: raw.location?.latitude ?? null,
      longitude: raw.location?.longitude ?? null,
      openingHours: Array.isArray(raw.regularOpeningHours?.weekdayDescriptions)
        ? raw.regularOpeningHours.weekdayDescriptions
        : [],
      isOpenNow: typeof raw.regularOpeningHours?.openNow === 'boolean'
        ? raw.regularOpeningHours.openNow
        : null,
      collectedAt: new Date().toISOString(),
      locationQuery,
      categoryQuery,
    };
  }
}
