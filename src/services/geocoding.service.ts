import axios, { AxiosError } from 'axios';
import { env, getApiKey } from '../config/env.js';
import { GeocodedLocation } from '../types/lead.types.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/helpers.js';

export class GeocodingService {
  /**
   * Geocodes a text location string to lat/lng coordinates and address components.
   * Uses Places API (New) searchText to resolve location without requiring separate Geocoding API.
   */
  public static async geocode(locationText: string): Promise<GeocodedLocation> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Google Maps API key is not configured.');
    }

    const maxRetries = env.MAX_RETRIES;
    let delay = env.RETRY_DELAY_MS;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await axios.post(
          'https://places.googleapis.com/v1/places:searchText',
          {
            textQuery: locationText,
            pageSize: 1,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask':
                'places.id,places.formattedAddress,places.location,places.addressComponents',
            },
            timeout: env.REQUEST_TIMEOUT_MS,
          }
        );

        const places = response.data?.places;
        if (!places || places.length === 0 || !places[0].location) {
          throw new Error(`Location "${locationText}" could not be resolved by Google Places API.`);
        }

        const place = places[0];
        const location: GeocodedLocation = {
          formattedAddress: place.formattedAddress || locationText,
          coordinates: {
            latitude: place.location.latitude,
            longitude: place.location.longitude,
          },
        };

        if (Array.isArray(place.addressComponents)) {
          for (const comp of place.addressComponents) {
            const types = comp.types || [];
            if (types.includes('locality')) {
              location.locality = comp.longText;
            } else if (types.includes('administrative_area_level_1')) {
              location.state = comp.longText;
            } else if (types.includes('country')) {
              location.country = comp.longText;
            } else if (types.includes('postal_code')) {
              location.postalCode = comp.longText;
            }
          }
        }

        return location;
      } catch (err) {
        const axiosErr = err as AxiosError<{ error?: { message?: string; status?: string } }>;
        const status = axiosErr.response?.status;
        const errMsg = axiosErr.response?.data?.error?.message || axiosErr.message;

        logger.warn({ attempt, status, error: errMsg }, `Geocoding attempt ${attempt} failed`);

        if (status === 400 || status === 403) {
          // Non-retriable auth/request errors
          throw new Error(`Google Places API Error (${status}): ${errMsg}`);
        }

        if (attempt <= maxRetries) {
          await sleep(delay);
          delay *= 2; // exponential backoff
        } else {
          throw new Error(`Failed to resolve location "${locationText}": ${errMsg}`);
        }
      }
    }

    throw new Error(`Failed to resolve location "${locationText}" after ${maxRetries} retries.`);
  }
}
