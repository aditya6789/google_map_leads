import assert from 'node:assert';
import fs from 'node:fs';
import { DeduplicationService } from '../src/modules/deduplication/deduplication.service.js';
import { LeadFilterService } from '../src/modules/filters/lead-filter.service.js';
import { ExportService } from '../src/services/export.service.js';
import { HistoryService } from '../src/modules/history/history.service.js';
import { BusinessLead } from '../src/types/lead.types.js';
import ExcelJS from 'exceljs';

async function runTests() {
  console.log('--- Starting Comprehensive Test Suite ---');

  // Test 1: Deduplication Service
  console.log('Testing Deduplication Priority...');
  const dedup = new DeduplicationService();

  const lead1: BusinessLead = {
    placeId: 'ChIJ123',
    businessName: 'Apex Coaching Institute',
    phoneNumber: '+91 98765 43210',
    fullAddress: 'Plot 4, Block B, Janakpuri, New Delhi',
    city: 'New Delhi',
    collectedAt: new Date().toISOString(),
  };

  const added1 = dedup.addIfUnique(lead1);
  assert.strictEqual(added1, true, 'Lead 1 should be added');

  // Duplicate 1: Same Place ID
  const leadDuplicatePlaceId: BusinessLead = {
    placeId: 'ChIJ123',
    businessName: 'Different Name Coaching',
    phoneNumber: '+91 11111 22222',
    fullAddress: 'Another Address',
    collectedAt: new Date().toISOString(),
  };
  const addedDupPlace = dedup.addIfUnique(leadDuplicatePlaceId);
  assert.strictEqual(addedDupPlace, false, 'Duplicate Place ID should be rejected');
  assert.strictEqual(dedup.getStats().duplicateByPlaceId, 1);

  // Duplicate 2: Different Place ID, same Phone number (normalized: 9876543210)
  const leadDuplicatePhone: BusinessLead = {
    placeId: 'ChIJ456',
    businessName: 'Apex Classes Janakpuri',
    phoneNumber: '09876543210', // same last 10 digits
    fullAddress: 'Somewhere nearby',
    collectedAt: new Date().toISOString(),
  };
  const addedDupPhone = dedup.addIfUnique(leadDuplicatePhone);
  assert.strictEqual(addedDupPhone, false, 'Duplicate Phone number should be rejected');
  assert.strictEqual(dedup.getStats().duplicateByPhone, 1);

  // Duplicate 3: Different Place ID and Phone, but same normalized Business Name & Address
  const leadDuplicateNameAddress: BusinessLead = {
    placeId: 'ChIJ789',
    businessName: 'APEX COACHING INSTITUTE!!!',
    phoneNumber: '+91 55555 66666',
    fullAddress: 'Plot 4, Block B, Janakpuri, New Delhi...',
    collectedAt: new Date().toISOString(),
  };
  const addedDupNameAddr = dedup.addIfUnique(leadDuplicateNameAddress);
  assert.strictEqual(addedDupNameAddr, false, 'Duplicate Name and Address should be rejected');
  assert.strictEqual(dedup.getStats().duplicateByNameAddress, 1);

  // Valid distinct lead
  const lead2: BusinessLead = {
    placeId: 'ChIJ999',
    businessName: 'Success Training Hub',
    phoneNumber: '+91 99999 88888',
    fullAddress: 'District Centre, Janakpuri, New Delhi',
    collectedAt: new Date().toISOString(),
  };
  const added2 = dedup.addIfUnique(lead2);
  assert.strictEqual(added2, true, 'Lead 2 should be unique');
  assert.strictEqual(dedup.getStats().uniqueCount, 2);
  console.log('✔ Deduplication Service passed all priority tests.');

  // Test 2: Lead Quality Filters
  console.log('Testing Lead Quality Filters...');
  const leadGood: BusinessLead = {
    placeId: 'ChIJ_G1',
    businessName: 'Star Academy',
    phoneNumber: '+91 98111 22233',
    website: 'https://staracademy.example.com',
    googleRating: 4.6,
    totalReviews: 85,
    businessStatus: 'OPERATIONAL',
    collectedAt: new Date().toISOString(),
  };

  const leadLowRating: BusinessLead = {
    ...leadGood,
    placeId: 'ChIJ_L1',
    googleRating: 3.2,
  };

  const leadClosed: BusinessLead = {
    ...leadGood,
    placeId: 'ChIJ_C1',
    businessStatus: 'CLOSED_PERMANENTLY',
  };

  const leadNoPhone: BusinessLead = {
    ...leadGood,
    placeId: 'ChIJ_NP1',
    phoneNumber: '',
  };

  const filters = {
    minRating: 4.0,
    minReviews: 10,
    mustHavePhone: true,
    mustHaveWebsite: true,
    operationalOnly: true,
  };

  assert.strictEqual(LeadFilterService.matches(leadGood, filters).pass, true);
  assert.strictEqual(LeadFilterService.matches(leadLowRating, filters).pass, false);
  assert.strictEqual(LeadFilterService.matches(leadClosed, filters).pass, false);
  assert.strictEqual(LeadFilterService.matches(leadNoPhone, filters).pass, false);
  console.log('✔ Lead Quality Filters passed all test cases.');

  // Test 3: Excel & CSV Generation
  console.log('Testing Excel & CSV Export...');
  const sampleLeads: BusinessLead[] = [
    leadGood,
    {
      placeId: 'ChIJ_G2',
      businessName: 'Excel Learning Point',
      category: 'Coaching Institutes',
      phoneNumber: '+91 98222 33344',
      fullAddress: 'A-12, Main Market, Janakpuri, New Delhi',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110058',
      country: 'India',
      website: 'https://excelpoint.edu',
      googleMapsUrl: 'https://maps.google.com/?cid=123456789',
      googleRating: 4.8,
      totalReviews: 142,
      businessStatus: 'OPERATIONAL',
      latitude: 28.6219,
      longitude: 77.0878,
      openingHours: ['Monday: 9:00 AM - 7:00 PM', 'Tuesday: 9:00 AM - 7:00 PM'],
      isOpenNow: true,
      collectedAt: new Date().toISOString(),
    },
  ];

  const exportRes = await ExportService.exportLeads({
    leads: sampleLeads,
    locationName: 'Janakpuri_Delhi',
    categoryName: 'Coaching_Institutes',
    format: 'both',
  });

  assert.ok(exportRes.excelPath, 'Excel file path should be present');
  assert.ok(fs.existsSync(exportRes.excelPath!), 'Excel file should exist on disk');
  assert.ok(exportRes.csvPath, 'CSV file path should be present');
  assert.ok(fs.existsSync(exportRes.csvPath!), 'CSV file should exist on disk');

  // Verify Excel file integrity with ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(exportRes.excelPath!);
  const sheet = workbook.getWorksheet('Leads');
  assert.ok(sheet, 'Leads worksheet must exist');
  assert.strictEqual(sheet.rowCount, 3, 'Header + 2 data rows = 3 rows');

  // Check header styling
  const headerCell = sheet.getCell('A1');
  assert.strictEqual(headerCell.value, 'Business Name');
  assert.ok(headerCell.font?.bold, 'Header font should be bold');

  // Check CSV contents
  const csvContent = fs.readFileSync(exportRes.csvPath!, 'utf8');
  assert.ok(csvContent.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  assert.ok(csvContent.includes('Star Academy'), 'CSV must contain lead business name');
  console.log('✔ Excel and CSV Generation verified.');

  // Test 4: History Service
  console.log('Testing History Service...');
  await HistoryService.saveHistoryEntry({
    id: 'test_search_1',
    timestamp: new Date().toISOString(),
    criteria: {
      locations: ['Janakpuri, Delhi, India'],
      categories: ['Coaching Institutes'],
      radiusKm: 5,
      targetLeads: 100,
      fields: ['businessName', 'phoneNumber'],
      filters: {},
      outputFormat: 'excel',
    },
    resultsCount: 2,
    outputFiles: [exportRes.excelPath!],
    durationMs: 1200,
  });

  const history = await HistoryService.getHistory();
  assert.ok(history.length > 0, 'History should contain at least 1 entry');
  assert.strictEqual(history[0].id, 'test_search_1');
  console.log('✔ History Service successfully persisted and retrieved search record.');

  console.log('\n--- ALL COMPREHENSIVE TESTS PASSED! ---');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
