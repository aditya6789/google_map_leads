import { BusinessLead, LeadQualityFilters } from '../../types/lead.types.js';

export class LeadFilterService {
  /**
   * Checks whether a business lead matches the given quality criteria.
   */
  public static matches(lead: BusinessLead, filters?: LeadQualityFilters): { pass: boolean; reason?: string } {
    if (!filters) return { pass: true };

    // Minimum Google rating
    if (filters.minRating !== undefined && filters.minRating > 0) {
      if (lead.googleRating === null || lead.googleRating === undefined || lead.googleRating < filters.minRating) {
        return { pass: false, reason: `Rating (${lead.googleRating ?? 'none'}) below min (${filters.minRating})` };
      }
    }

    // Minimum review count
    if (filters.minReviews !== undefined && filters.minReviews > 0) {
      if (lead.totalReviews === null || lead.totalReviews === undefined || lead.totalReviews < filters.minReviews) {
        return { pass: false, reason: `Reviews (${lead.totalReviews ?? 0}) below min (${filters.minReviews})` };
      }
    }

    // Must have phone number
    if (filters.mustHavePhone) {
      if (!lead.phoneNumber || lead.phoneNumber.trim().length === 0) {
        return { pass: false, reason: 'Missing phone number' };
      }
    }

    // Must have website
    if (filters.mustHaveWebsite) {
      if (!lead.website || lead.website.trim().length === 0) {
        return { pass: false, reason: 'Missing website' };
      }
    }

    // Operational businesses only
    if (filters.operationalOnly) {
      if (lead.businessStatus && lead.businessStatus !== 'OPERATIONAL') {
        return { pass: false, reason: `Non-operational status: ${lead.businessStatus}` };
      }
    }

    return { pass: true };
  }

  /**
   * Filters an array of leads based on quality filters.
   */
  public static filterLeads(leads: BusinessLead[], filters?: LeadQualityFilters): { passed: BusinessLead[]; filteredOutCount: number } {
    if (!filters) {
      return { passed: leads, filteredOutCount: 0 };
    }

    const passed: BusinessLead[] = [];
    let filteredOutCount = 0;

    for (const lead of leads) {
      if (this.matches(lead, filters).pass) {
        passed.push(lead);
      } else {
        filteredOutCount++;
      }
    }

    return { passed, filteredOutCount };
  }
}
