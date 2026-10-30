import {
  BusinessLead,
  SearchCriteria,
  SearchProgressStats,
  GeocodedLocation,
} from '../types/lead.types.js';
import { GooglePlacesService } from './google-places.service.js';
import { GeocodingService } from './geocoding.service.js';
import { DeduplicationService } from '../modules/deduplication/deduplication.service.js';
import { LeadFilterService } from '../modules/filters/lead-filter.service.js';
import { ExportService, ExportResult } from './export.service.js';
import { HistoryService } from '../modules/history/history.service.js';
import { sleep } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

export interface LocationSearchResult {
  location: string;
  geocoded?: GeocodedLocation;
  leads: BusinessLead[];
  exportResult: ExportResult;
  stats: SearchProgressStats;
  stoppedEarly: boolean;
  error?: string;
}

export class LeadCollectorService {
  private deduplicator = new DeduplicationService();
  private isAborted = false;
  private currentCollectedLeads: BusinessLead[] = [];
  private currentSearchLocation = '';
  private currentSearchCategory = '';

  /**
   * Request interruption of current running search
   */
  public abort(): void {
    this.isAborted = true;
  }

  public getCollectedSoFar(): BusinessLead[] {
    return [...this.currentCollectedLeads];
  }

  /**
   * Executes a search for a single location across all specified categories.
   */
  public async executeLocationSearch(
    location: string,
    criteria: SearchCriteria,
    locationIndex: number,
    totalLocations: number,
    onProgress?: (stats: SearchProgressStats) => void
  ): Promise<LocationSearchResult> {
    this.deduplicator.reset();
    this.currentCollectedLeads = [];
    this.isAborted = false;
    this.currentSearchLocation = location;

    const collectedLeads: BusinessLead[] = [];
    let geocoded: GeocodedLocation | undefined;

    const progressStats: SearchProgressStats = {
      locationIndex: locationIndex + 1,
      totalLocations,
      currentLocation: location,
      categoryIndex: 0,
      totalCategories: criteria.categories.length,
      currentCategory: '',
      targetLeads: criteria.targetLeads,
      totalFound: 0,
      uniqueLeads: 0,
      duplicatesRemoved: 0,
      phoneNumbersFound: 0,
      websitesFound: 0,
      filteredOut: 0,
      statusMessage: 'Resolving location coordinates...',
      percent: 0,
    };

    onProgress?.(progressStats);

    // 1. Geocode location
    try {
      geocoded = await GeocodingService.geocode(location);
      progressStats.statusMessage = `Resolved to: ${geocoded.formattedAddress}`;
      onProgress?.(progressStats);
    } catch (err: any) {
      logger.warn({ location, error: err.message }, 'Geocoding failed; proceeding with raw text query');
      progressStats.statusMessage = `Geocoding notice: ${err.message}. Using text query bias.`;
      onProgress?.(progressStats);
    }

    const radiusMeters = criteria.radiusKm * 1000;

    let lastError: string | undefined = undefined;

    // 2. Iterate through categories
    for (let cIdx = 0; cIdx < criteria.categories.length; cIdx++) {
      if (this.isAborted || collectedLeads.length >= criteria.targetLeads) {
        break;
      }

      const category = criteria.categories[cIdx];
      this.currentSearchCategory = category;
      progressStats.categoryIndex = cIdx + 1;
      progressStats.currentCategory = category;
      progressStats.statusMessage = `Searching category "${category}" in "${location}"...`;
      onProgress?.(progressStats);

      let pageToken: string | undefined = undefined;
      let pageCount = 0;
      const MAX_PAGES_PER_CATEGORY = 5; // Up to 100 results per category query

      while (!this.isAborted && collectedLeads.length < criteria.targetLeads) {
        pageCount++;
        progressStats.statusMessage = `Fetching page ${pageCount} for "${category}"...`;
        onProgress?.(progressStats);

        let searchResult;
        try {
          searchResult = await GooglePlacesService.searchPlaces({
            category,
            locationText: geocoded?.formattedAddress || location,
            coordinates: geocoded?.coordinates,
            radiusMeters,
            requestedFields: criteria.fields,
            pageToken,
          });
        } catch (err: any) {
          lastError = err.message;
          logger.error({ category, location, err: err.message }, 'Places search error');
          progressStats.statusMessage = `Search error for "${category}": ${err.message}`;
          onProgress?.(progressStats);
          break;
        }

        const rawLeads = searchResult.leads;
        progressStats.totalFound += rawLeads.length;

        if (rawLeads.length === 0) {
          break;
        }

        for (const rawLead of rawLeads) {
          if (collectedLeads.length >= criteria.targetLeads) {
            break;
          }

          // Apply quality filters
          const filterCheck = LeadFilterService.matches(rawLead, criteria.filters);
          if (!filterCheck.pass) {
            progressStats.filteredOut++;
            continue;
          }

          // Deduplicate
          const isUnique = this.deduplicator.addIfUnique(rawLead);
          if (!isUnique) {
            progressStats.duplicatesRemoved++;
            continue;
          }

          // Unique lead accepted!
          collectedLeads.push(rawLead);
          this.currentCollectedLeads.push(rawLead);

          progressStats.uniqueLeads = collectedLeads.length;
          if (rawLead.phoneNumber) progressStats.phoneNumbersFound++;
          if (rawLead.website) progressStats.websitesFound++;

          const percent = Math.min(
            Math.round((collectedLeads.length / criteria.targetLeads) * 100),
            100
          );
          progressStats.percent = percent;
          progressStats.statusMessage = `Found ${collectedLeads.length} / ${criteria.targetLeads} leads`;
          onProgress?.(progressStats);
        }

        if (collectedLeads.length >= criteria.targetLeads) {
          progressStats.statusMessage = `Target lead goal reached (${collectedLeads.length} leads).`;
          onProgress?.(progressStats);
          break;
        }

        pageToken = searchResult.nextPageToken;
        if (!pageToken || pageCount >= MAX_PAGES_PER_CATEGORY) {
          break;
        }

        // Wait a short moment before querying next page token to allow Google token initialization
        progressStats.statusMessage = 'Fetching next page of results...';
        onProgress?.(progressStats);
        await sleep(1500);
      }
    }

    progressStats.percent = Math.min(
      Math.round((collectedLeads.length / criteria.targetLeads) * 100),
      100
    );
    progressStats.statusMessage = this.isAborted
      ? 'Search cancelled by user. Saving partial results...'
      : 'Exporting collected leads...';
    onProgress?.(progressStats);

    // 3. Export Leads
    const exportResult = await ExportService.exportLeads({
      leads: collectedLeads,
      locationName: location,
      categoryName: criteria.categories.join('_'),
      format: criteria.outputFormat,
      fields: criteria.fields,
    });

    return {
      location,
      geocoded,
      leads: collectedLeads,
      exportResult,
      stats: progressStats,
      stoppedEarly: this.isAborted || collectedLeads.length < criteria.targetLeads,
      error: lastError,
    };
  }

  /**
   * Runs the entire search criteria workflow across all locations.
   */
  public async runSearchWorkflow(
    criteria: SearchCriteria,
    onProgress?: (stats: SearchProgressStats) => void
  ): Promise<{
    results: LocationSearchResult[];
    combinedExport?: ExportResult;
    allLeads: BusinessLead[];
    totalUniqueLeads: number;
  }> {
    const startTime = Date.now();
    const locationResults: LocationSearchResult[] = [];
    const allLeadsAcrossLocations: BusinessLead[] = [];
    const globalDeduplicator = new DeduplicationService();

    for (let i = 0; i < criteria.locations.length; i++) {
      if (this.isAborted) break;

      const loc = criteria.locations[i];
      const result = await this.executeLocationSearch(
        loc,
        criteria,
        i,
        criteria.locations.length,
        onProgress
      );

      locationResults.push(result);

      // Collect unique leads for global combined report if multiple locations
      for (const lead of result.leads) {
        if (globalDeduplicator.addIfUnique(lead)) {
          allLeadsAcrossLocations.push(lead);
        }
      }
    }

    let combinedExport: ExportResult | undefined = undefined;

    // If multiple locations were searched and combineMultiLocations is requested, generate a master file
    if (criteria.locations.length > 1 && allLeadsAcrossLocations.length > 0) {
      combinedExport = await ExportService.exportLeads({
        leads: allLeadsAcrossLocations,
        locationName: `combined_${criteria.locations.length}_locations`,
        categoryName: criteria.categories.join('_'),
        format: criteria.outputFormat,
        fields: criteria.fields,
      });
    }

    // Save search history
    const allOutputFiles: string[] = [];
    locationResults.forEach((r) => {
      if (r.exportResult.excelPath) allOutputFiles.push(r.exportResult.excelPath);
      if (r.exportResult.csvPath) allOutputFiles.push(r.exportResult.csvPath);
    });
    if (combinedExport?.excelPath) allOutputFiles.push(combinedExport.excelPath);
    if (combinedExport?.csvPath) allOutputFiles.push(combinedExport.csvPath);

    await HistoryService.saveHistoryEntry({
      id: `search_${Date.now()}`,
      timestamp: new Date().toISOString(),
      criteria,
      resultsCount: allLeadsAcrossLocations.length,
      outputFiles: allOutputFiles,
      durationMs: Date.now() - startTime,
    });

    return {
      results: locationResults,
      combinedExport,
      allLeads: allLeadsAcrossLocations,
      totalUniqueLeads: allLeadsAcrossLocations.length,
    };
  }
}
