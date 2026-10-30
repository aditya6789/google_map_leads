import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { env } from '../config/env.js';
import { BusinessLead, LeadFieldKey, OutputFormat } from '../types/lead.types.js';
import { getUniqueFilePath, sanitizeFilename, formatDateForFilename } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

export interface ExportResult {
  excelPath?: string;
  csvPath?: string;
  recordCount: number;
}

export class ExportService {
  /**
   * Generates output files (Excel, CSV, or both) for collected leads.
   */
  public static async exportLeads(params: {
    leads: BusinessLead[];
    locationName: string;
    categoryName: string;
    format: OutputFormat;
    fields?: LeadFieldKey[];
  }): Promise<ExportResult> {
    const { leads, locationName, categoryName, format, fields } = params;

    if (!fsSync.existsSync(env.OUTPUT_DIR)) {
      await fs.mkdir(env.OUTPUT_DIR, { recursive: true });
    }

    const timestamp = formatDateForFilename();
    const cleanLoc = sanitizeFilename(locationName);
    const cleanCat = sanitizeFilename(categoryName);
    const baseFilename = `leads_${cleanLoc}_${cleanCat}_${timestamp}`;

    const result: ExportResult = {
      recordCount: leads.length,
    };

    if (format === 'excel' || format === 'both') {
      const targetExcelPath = getUniqueFilePath(path.join(env.OUTPUT_DIR, `${baseFilename}.xlsx`));
      await this.generateExcel(leads, targetExcelPath, locationName, categoryName, fields);
      result.excelPath = targetExcelPath;
      logger.info({ path: targetExcelPath, count: leads.length }, 'Excel file exported successfully');
    }

    if (format === 'csv' || format === 'both') {
      const targetCsvPath = getUniqueFilePath(path.join(env.OUTPUT_DIR, `${baseFilename}.csv`));
      await this.generateCsv(leads, targetCsvPath, fields);
      result.csvPath = targetCsvPath;
      logger.info({ path: targetCsvPath, count: leads.length }, 'CSV file exported successfully');
    }

    return result;
  }

  /**
   * Builds and writes an Excel workbook with styling, auto-filters, hyperlinks, and frozen panes.
   */
  private static async generateExcel(
    leads: BusinessLead[],
    filePath: string,
    locationName: string,
    categoryName: string,
    fields?: LeadFieldKey[]
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Google Maps Lead Generator';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Leads', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
      properties: { defaultRowHeight: 22 },
    });

    const columnsConfig = this.getColumnsConfig(fields);
    sheet.columns = columnsConfig.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
    }));

    // Style Header Row (Row 1)
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A73E8' }, // Google Blue
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: false,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1558B0' } },
        bottom: { style: 'medium', color: { argb: 'FF0D47A1' } },
        left: { style: 'thin', color: { argb: 'FF1558B0' } },
        right: { style: 'thin', color: { argb: 'FF1558B0' } },
      };
    });

    // Populate data rows
    leads.forEach((lead, index) => {
      const rowNumber = index + 2;
      const rowData: Record<string, any> = {};

      columnsConfig.forEach((col) => {
        const val = this.extractValue(lead, col.key);
        rowData[col.key] = val;
      });

      const row = sheet.addRow(rowData);
      row.height = 20;

      const isEvenRow = index % 2 === 1;
      const zebraBg = isEvenRow ? 'FFF8F9FA' : 'FFFFFFFF';

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colKey = columnsConfig[colNumber - 1]?.key;

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: zebraBg },
        };

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE8E8E8' } },
          right: { style: 'thin', color: { argb: 'FFE8E8E8' } },
        };

        cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF202124' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };

        // Hyperlinks for Website & Maps URL
        if (colKey === 'website' && lead.website) {
          const webUrl = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;
          cell.value = {
            text: lead.website,
            hyperlink: webUrl,
          };
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1A0DAB' }, underline: true };
        } else if (colKey === 'googleMapsUrl' && lead.googleMapsUrl) {
          cell.value = {
            text: 'View on Google Maps',
            hyperlink: lead.googleMapsUrl,
          };
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1A0DAB' }, underline: true };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colKey === 'googleRating' && typeof lead.googleRating === 'number') {
          cell.numFmt = '0.0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colKey === 'totalReviews' && typeof lead.totalReviews === 'number') {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colKey === 'phoneNumber') {
          cell.numFmt = '@'; // Store explicitly as string format
        } else if (colKey === 'businessStatus') {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    // Apply auto-filter across all columns
    if (columnsConfig.length > 0) {
      const lastColLetter = this.getColumnLetter(columnsConfig.length);
      sheet.autoFilter = `A1:${lastColLetter}${Math.max(leads.length + 1, 2)}`;
    }

    // Auto-fit column widths with padding
    columnsConfig.forEach((colDef, idx) => {
      let maxLen = colDef.header.length;
      leads.forEach((lead) => {
        const val = this.extractValue(lead, colDef.key);
        if (val) {
          const strVal = String(val);
          if (strVal.length > maxLen) {
            maxLen = Math.min(strVal.length, 55); // max column width 55
          }
        }
      });
      const column = sheet.getColumn(idx + 1);
      column.width = Math.max(maxLen + 4, colDef.width || 12);
    });

    await workbook.xlsx.writeFile(filePath);
  }

  /**
   * Generates a clean UTF-8 encoded CSV file with BOM.
   */
  private static async generateCsv(
    leads: BusinessLead[],
    filePath: string,
    fields?: LeadFieldKey[]
  ): Promise<void> {
    const columnsConfig = this.getColumnsConfig(fields);
    const headers = columnsConfig.map((c) => this.escapeCsv(c.header)).join(',');

    const rows: string[] = [];
    for (const lead of leads) {
      const line = columnsConfig
        .map((col) => {
          const val = this.extractValue(lead, col.key);
          return this.escapeCsv(val ?? '');
        })
        .join(',');
      rows.push(line);
    }

    // Prepend UTF-8 BOM (\uFEFF) so Excel displays international characters without mojibake
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    await fs.writeFile(filePath, csvContent, 'utf8');
  }

  private static escapeCsv(value: any): string {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
      return `"${str}"`;
    }
    return `"${str}"`;
  }

  private static extractValue(lead: BusinessLead, key: string): any {
    switch (key) {
      case 'businessName':
        return lead.businessName;
      case 'category':
        return lead.category || lead.primaryType || '';
      case 'phoneNumber':
        return lead.phoneNumber || '';
      case 'fullAddress':
        return lead.fullAddress || '';
      case 'city':
        return lead.city || '';
      case 'state':
        return lead.state || '';
      case 'pincode':
        return lead.pincode || '';
      case 'country':
        return lead.country || '';
      case 'website':
        return lead.website || '';
      case 'googleMapsUrl':
        return lead.googleMapsUrl || '';
      case 'googleRating':
        return lead.googleRating ?? '';
      case 'totalReviews':
        return lead.totalReviews ?? '';
      case 'businessStatus':
        return lead.businessStatus || '';
      case 'latitude':
        return lead.latitude ?? '';
      case 'longitude':
        return lead.longitude ?? '';
      case 'placeId':
        return lead.placeId || '';
      case 'openingHours':
        return lead.openingHours?.join('; ') || '';
      default:
        return (lead as any)[key] ?? '';
    }
  }

  private static getColumnsConfig(fields?: LeadFieldKey[]): Array<{ header: string; key: string; width: number }> {
    const allColumns = [
      { header: 'Business Name', key: 'businessName', width: 28 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Phone Number', key: 'phoneNumber', width: 18 },
      { header: 'Full Address', key: 'fullAddress', width: 36 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'State', key: 'state', width: 16 },
      { header: 'Pincode', key: 'pincode', width: 12 },
      { header: 'Website', key: 'website', width: 28 },
      { header: 'Google Maps URL', key: 'googleMapsUrl', width: 24 },
      { header: 'Google Rating', key: 'googleRating', width: 14 },
      { header: 'Total Reviews', key: 'totalReviews', width: 14 },
      { header: 'Business Status', key: 'businessStatus', width: 16 },
      { header: 'Latitude', key: 'latitude', width: 14 },
      { header: 'Longitude', key: 'longitude', width: 14 },
      { header: 'Place ID', key: 'placeId', width: 28 },
      { header: 'Opening Hours', key: 'openingHours', width: 32 },
    ];

    if (!fields || fields.length === 0) {
      return allColumns;
    }

    const fieldMap: Record<LeadFieldKey, string[]> = {
      businessName: ['businessName'],
      category: ['category'],
      phoneNumber: ['phoneNumber'],
      fullAddress: ['fullAddress'],
      city: ['city'],
      state: ['state'],
      pincode: ['pincode'],
      website: ['website'],
      googleMapsUrl: ['googleMapsUrl'],
      googleRating: ['googleRating'],
      totalReviews: ['totalReviews'],
      businessStatus: ['businessStatus'],
      coordinates: ['latitude', 'longitude'],
      openingHours: ['openingHours'],
    };

    const activeKeys = new Set<string>(['placeId']); // Always include Place ID for tracking & compliance
    fields.forEach((f) => {
      const mapped = fieldMap[f];
      if (mapped) {
        mapped.forEach((k) => activeKeys.add(k));
      }
    });

    return allColumns.filter((col) => activeKeys.has(col.key));
  }

  private static getColumnLetter(colIndex: number): string {
    let letter = '';
    while (colIndex > 0) {
      const rem = (colIndex - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      colIndex = Math.floor((colIndex - 1) / 26);
    }
    return letter || 'A';
  }
}
