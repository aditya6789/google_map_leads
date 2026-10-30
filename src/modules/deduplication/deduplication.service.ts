import { BusinessLead } from '../../types/lead.types.js';
import {
  normalizeBusinessName,
  normalizeAddress,
  normalizePhoneNumber,
} from '../../utils/helpers.js';

export interface DeduplicationStats {
  totalChecked: number;
  duplicatesRemoved: number;
  uniqueCount: number;
  duplicateByPlaceId: number;
  duplicateByPhone: number;
  duplicateByNameAddress: number;
}

export class DeduplicationService {
  private seenPlaceIds = new Set<string>();
  private seenPhones = new Set<string>();
  private seenNameAndAddress = new Set<string>();

  private stats: DeduplicationStats = {
    totalChecked: 0,
    duplicatesRemoved: 0,
    uniqueCount: 0,
    duplicateByPlaceId: 0,
    duplicateByPhone: 0,
    duplicateByNameAddress: 0,
  };

  /**
   * Resets the deduplication cache and statistics.
   */
  public reset(): void {
    this.seenPlaceIds.clear();
    this.seenPhones.clear();
    this.seenNameAndAddress.clear();
    this.stats = {
      totalChecked: 0,
      duplicatesRemoved: 0,
      uniqueCount: 0,
      duplicateByPlaceId: 0,
      duplicateByPhone: 0,
      duplicateByNameAddress: 0,
    };
  }

  /**
   * Checks if lead is duplicate using the 3-step priority:
   * 1. Google Place ID
   * 2. Normalized phone number (if phone present)
   * 3. Normalized business name and address
   */
  public check(lead: BusinessLead): { isDuplicate: boolean; reason?: 'place_id' | 'phone' | 'name_address' } {
    // 1. Check Place ID
    if (lead.placeId && this.seenPlaceIds.has(lead.placeId)) {
      return { isDuplicate: true, reason: 'place_id' };
    }

    // 2. Check Normalized Phone Number
    const normalizedPhone = normalizePhoneNumber(lead.phoneNumber);
    if (normalizedPhone && this.seenPhones.has(normalizedPhone)) {
      return { isDuplicate: true, reason: 'phone' };
    }

    // 3. Check Normalized Business Name + Address
    const normName = normalizeBusinessName(lead.businessName);
    const normAddress = normalizeAddress(lead.fullAddress || lead.city || '');
    if (normName) {
      const nameAddrKey = `${normName}:::${normAddress}`;
      if (this.seenNameAndAddress.has(nameAddrKey)) {
        return { isDuplicate: true, reason: 'name_address' };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Processes a lead: if unique, tracks it and returns true. If duplicate, increments stats and returns false.
   */
  public addIfUnique(lead: BusinessLead): boolean {
    this.stats.totalChecked++;

    const checkResult = this.check(lead);
    if (checkResult.isDuplicate) {
      this.stats.duplicatesRemoved++;
      if (checkResult.reason === 'place_id') this.stats.duplicateByPlaceId++;
      else if (checkResult.reason === 'phone') this.stats.duplicateByPhone++;
      else if (checkResult.reason === 'name_address') this.stats.duplicateByNameAddress++;
      return false;
    }

    // Register identifiers
    if (lead.placeId) {
      this.seenPlaceIds.add(lead.placeId);
    }

    const normalizedPhone = normalizePhoneNumber(lead.phoneNumber);
    if (normalizedPhone) {
      this.seenPhones.add(normalizedPhone);
    }

    const normName = normalizeBusinessName(lead.businessName);
    const normAddress = normalizeAddress(lead.fullAddress || lead.city || '');
    if (normName) {
      this.seenNameAndAddress.add(`${normName}:::${normAddress}`);
    }

    this.stats.uniqueCount++;
    return true;
  }

  /**
   * Filters an array of leads, returning only unique ones.
   */
  public filterUnique(leads: BusinessLead[]): BusinessLead[] {
    const result: BusinessLead[] = [];
    for (const lead of leads) {
      if (this.addIfUnique(lead)) {
        result.push(lead);
      }
    }
    return result;
  }

  public getStats(): Readonly<DeduplicationStats> {
    return { ...this.stats };
  }
}
