import {
  select,
  input,
  checkbox,
  confirm,
} from '@inquirer/prompts';
import chalk from 'chalk';
import {
  LeadFieldKey,
  LeadQualityFilters,
  OutputFormat,
  SearchCriteria,
} from '../types/lead.types.js';
import {
  validateLeadCount,
  validateLocation,
  validateRadius,
  validateCategory,
} from '../utils/validators.js';
import { parseCommaSeparatedList } from '../utils/helpers.js';

export async function promptMainMenu(): Promise<
  'quick' | 'multi' | 'history' | 'presets' | 'apikey' | 'exit'
> {
  return select({
    message: 'What would you like to do?',
    choices: [
      {
        name: `${chalk.bold.green('▶')} New Lead Search (Standard)`,
        value: 'quick',
        description: 'Search businesses in a target location by category',
      },
      {
        name: `${chalk.bold.cyan('⤹')} Multi-Location / Multi-Category Search`,
        value: 'multi',
        description: 'Search across multiple locations or categories in one batch',
      },
      {
        name: `${chalk.bold.yellow('↺')} Rerun Previous Search (from History)`,
        value: 'history',
        description: 'View previous searches and rerun them with one click',
      },
      {
        name: `${chalk.bold.magenta('★')} Saved Search Configurations`,
        value: 'presets',
        description: 'Load or run saved search templates',
      },
      {
        name: `${chalk.bold.blue('⚙')} Configure / Test Google Maps API Key`,
        value: 'apikey',
        description: 'Set your API key and verify connection to Places API (New)',
      },
      {
        name: `${chalk.gray('✖')} Exit`,
        value: 'exit',
      },
    ],
  });
}

export async function promptCategories(multiAllowed = true): Promise<string[]> {
  const PREDEFINED_CATEGORIES = [
    'Coaching Institutes',
    'Tuition Classes',
    'Schools',
    'Computer Institutes',
    'Training Centres',
    'Educational Academies',
    'Clinics',
    'Hospitals',
    'Real Estate Agencies',
    'Other / Custom Category',
  ];

  if (!multiAllowed) {
    const chosen = await select({
      message: 'Select business category:',
      choices: PREDEFINED_CATEGORIES.map((cat) => ({ name: cat, value: cat })),
    });

    if (chosen === 'Other / Custom Category') {
      const custom = await input({
        message: 'Enter custom category (or comma-separated categories):',
        validate: validateCategory,
      });
      return parseCommaSeparatedList(custom);
    }
    return [chosen];
  }

  const selected = await checkbox({
    message: 'Select business categories to search:',
    choices: PREDEFINED_CATEGORIES.map((cat) => ({
      name: cat,
      value: cat,
      checked: cat === 'Coaching Institutes',
    })),
    validate: (choices) => (choices.length > 0 ? true : 'Please select at least one category.'),
  });

  const finalCategories: string[] = [];

  for (const cat of selected) {
    if (cat === 'Other / Custom Category') {
      const custom = await input({
        message: 'Enter custom business categories (comma-separated):',
        validate: validateCategory,
      });
      finalCategories.push(...parseCommaSeparatedList(custom));
    } else {
      finalCategories.push(cat);
    }
  }

  return Array.from(new Set(finalCategories));
}

export async function promptLocations(multi = false): Promise<string[]> {
  if (!multi) {
    const loc = await input({
      message: 'Enter Location (e.g. "Janakpuri, Delhi, India"):',
      validate: validateLocation,
      default: 'Janakpuri, Delhi, India',
    });
    return [loc.trim()];
  }

  const raw = await input({
    message:
      'Enter Locations (comma-separated, e.g. "Janakpuri, Delhi, India, Dwarka, Delhi, India"):',
    validate: validateLocation,
  });

  const list = parseCommaSeparatedList(raw);
  return list.length > 0 ? list : ['Janakpuri, Delhi, India'];
}

export async function promptRadius(): Promise<number> {
  const choice = await select({
    message: 'Search Radius:',
    choices: [
      { name: '5 KM (Recommended for city neighbourhoods)', value: '5' },
      { name: '10 KM (Standard city range)', value: '10' },
      { name: '15 KM', value: '15' },
      { name: '20 KM', value: '20' },
      { name: '25 KM', value: '25' },
      { name: 'Custom Radius...', value: 'custom' },
    ],
  });

  if (choice === 'custom') {
    const custom = await input({
      message: 'Enter radius in KM (1 - 50):',
      validate: validateRadius,
      default: '5',
    });
    return parseFloat(custom.trim());
  }

  return parseFloat(choice);
}

export async function promptTargetLeads(): Promise<number> {
  const choice = await select({
    message: 'How many leads do you need?',
    choices: [
      { name: '25 leads (Quick test)', value: '25' },
      { name: '50 leads (Standard)', value: '50' },
      { name: '100 leads (Recommended)', value: '100' },
      { name: '200 leads', value: '200' },
      { name: 'Custom lead count...', value: 'custom' },
    ],
  });

  if (choice === 'custom') {
    const custom = await input({
      message: 'Enter required number of leads (1 - 1000):',
      validate: validateLeadCount,
      default: '100',
    });
    return parseInt(custom.trim(), 10);
  }

  return parseInt(choice, 10);
}

export async function promptFieldsToCollect(): Promise<LeadFieldKey[]> {
  return checkbox({
    message: 'Which information should be collected?',
    choices: [
      { name: 'Business Name', value: 'businessName', checked: true },
      { name: 'Business Category', value: 'category', checked: true },
      { name: 'Phone Number', value: 'phoneNumber', checked: true },
      { name: 'Full Address', value: 'fullAddress', checked: true },
      { name: 'City', value: 'city', checked: true },
      { name: 'State', value: 'state', checked: true },
      { name: 'Pincode / Postal Code', value: 'pincode', checked: true },
      { name: 'Website', value: 'website', checked: true },
      { name: 'Google Maps Link', value: 'googleMapsUrl', checked: true },
      { name: 'Google Rating', value: 'googleRating', checked: true },
      { name: 'Total Reviews', value: 'totalReviews', checked: true },
      { name: 'Business Status (Operational, etc.)', value: 'businessStatus', checked: true },
      { name: 'Coordinates (Lat/Lng)', value: 'coordinates', checked: true },
      { name: 'Opening Hours', value: 'openingHours', checked: false },
    ],
  });
}

export async function promptQualityFilters(): Promise<LeadQualityFilters> {
  const applyFilters = await confirm({
    message: 'Do you want to apply Lead Quality Filters? (e.g. min rating, must have phone/website)',
    default: false,
  });

  if (!applyFilters) {
    return { operationalOnly: true };
  }

  const ratingChoice = await select({
    message: 'Minimum Google Rating:',
    choices: [
      { name: 'Any rating', value: '0' },
      { name: '★ 3.5 & above', value: '3.5' },
      { name: '★ 4.0 & above (Recommended)', value: '4.0' },
      { name: '★ 4.5 & above (Top rated only)', value: '4.5' },
    ],
  });

  const reviewsChoice = await select({
    message: 'Minimum Number of Reviews:',
    choices: [
      { name: 'Any review count', value: '0' },
      { name: '5+ reviews', value: '5' },
      { name: '10+ reviews', value: '10' },
      { name: '25+ reviews', value: '25' },
      { name: '50+ reviews', value: '50' },
    ],
  });

  const mustHavePhone = await confirm({
    message: 'Only include businesses with a Phone Number?',
    default: false,
  });

  const mustHaveWebsite = await confirm({
    message: 'Only include businesses with a Website?',
    default: false,
  });

  const operationalOnly = await confirm({
    message: 'Exclude permanently or temporarily closed businesses (Operational only)?',
    default: true,
  });

  return {
    minRating: parseFloat(ratingChoice),
    minReviews: parseInt(reviewsChoice, 10),
    mustHavePhone,
    mustHaveWebsite,
    operationalOnly,
  };
}

export async function promptOutputFormat(): Promise<OutputFormat> {
  return select({
    message: 'Output Format:',
    choices: [
      { name: 'Excel (.xlsx) [Recommended - with styles & clickable links]', value: 'excel' },
      { name: 'CSV (.csv)', value: 'csv' },
      { name: 'Both (.xlsx and .csv)', value: 'both' },
    ],
  });
}

export async function promptConfirmStart(): Promise<boolean> {
  return confirm({
    message: 'Start searching now?',
    default: true,
  });
}

export async function promptSaveAsPreset(): Promise<string | null> {
  const shouldSave = await confirm({
    message: 'Save this search configuration as a reusable preset?',
    default: false,
  });

  if (!shouldSave) return null;

  return input({
    message: 'Enter a name for this preset (e.g. "Delhi Coaching 100"):',
    default: 'My Search Preset',
  });
}

export async function promptApiKey(): Promise<string> {
  console.log(
    chalk.yellow(
      '\nA Google Maps Platform API key is required to use this application.\n' +
        '1. Go to Google Cloud Console: https://console.cloud.google.com/\n' +
        '2. Enable "Places API (New)".\n' +
        '3. Create an API key in Credentials and paste it below.\n'
    )
  );

  return input({
    message: 'Enter your Google Maps API Key:',
    validate: (key) => (key.trim().length > 10 ? true : 'Please enter a valid API key.'),
  });
}
