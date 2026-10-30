#!/usr/bin/env node
import chalk from 'chalk';
import { select, confirm } from '@inquirer/prompts';
import { env, getApiKey, setApiKey, maskApiKey, ensureDirectories } from './config/env.js';
import { showWelcomeBanner, showComplianceNotice } from './cli/welcome.js';
import {
  promptMainMenu,
  promptCategories,
  promptLocations,
  promptRadius,
  promptTargetLeads,
  promptFieldsToCollect,
  promptQualityFilters,
  promptOutputFormat,
  promptConfirmStart,
  promptSaveAsPreset,
  promptApiKey,
} from './cli/prompts.js';
import { ProgressRenderer } from './cli/progress.js';
import { GooglePlacesService } from './services/google-places.service.js';
import { LeadCollectorService } from './services/lead-collector.service.js';
import { HistoryService } from './modules/history/history.service.js';
import { SearchCriteria, SearchHistoryEntry } from './types/lead.types.js';
import { logger } from './utils/logger.js';

let activeCollector: LeadCollectorService | null = null;

// Graceful SIGINT handling
process.on('SIGINT', async () => {
  if (activeCollector) {
    console.log(chalk.bold.red('\n\n[Ctrl+C] Search interrupted by user!'));
    console.log(chalk.yellow('Safely finalizing and saving collected leads...'));
    activeCollector.abort();
    // Allow small delay for export to finish
    setTimeout(() => {
      console.log(chalk.gray('Process exited.'));
      process.exit(0);
    }, 2500);
  } else {
    console.log(chalk.gray('\nGoodbye!'));
    process.exit(0);
  }
});

async function ensureValidApiKey(): Promise<boolean> {
  let key = getApiKey();

  if (!key) {
    console.log(chalk.yellow('No Google Maps API Key found in environment.'));
    const inputKey = await promptApiKey();
    console.log(chalk.cyan('Validating API key with Google Places API (New)...'));

    const validation = await GooglePlacesService.validateApiKey(inputKey);
    if (!validation.valid) {
      console.log(chalk.red(`\n✖ API Key validation failed:\n${validation.error}\n`));
      const retry = await confirm({
        message: 'Would you like to try entering the key again?',
        default: true,
      });
      if (retry) {
        return ensureValidApiKey();
      }
      return false;
    }

    setApiKey(inputKey, true);
    console.log(chalk.green('✔ API Key validated and saved to .env!\n'));
    return true;
  }

  // If key is present, perform a lightweight check to inform user upfront if Places API (New) is enabled
  const check = await GooglePlacesService.validateApiKey(key);
  if (!check.valid) {
    console.log(chalk.yellow('\n⚠ Google Cloud API Key Notice:'));
    console.log(chalk.white(check.error));
    console.log(chalk.gray('(You can still update the key from "Configure / Test Google Maps API Key" in the menu)\n'));
  }

  return true;
}

async function handleConfigureApiKey(): Promise<void> {
  const current = getApiKey();
  console.log(`Current API Key: ${chalk.green(maskApiKey(current))}`);

  const choice = await select({
    message: 'Google Maps API Key Settings:',
    choices: [
      { name: 'Test current API key connection', value: 'test' },
      { name: 'Update / replace API key', value: 'update' },
      { name: 'Return to Main Menu', value: 'back' },
    ],
  });

  if (choice === 'test') {
    console.log(chalk.cyan('Testing connection to Google Places API (New)...'));
    const testRes = await GooglePlacesService.validateApiKey(current);
    if (testRes.valid) {
      console.log(chalk.bold.green('✔ Success! Your API key is valid and Places API (New) is responsive.\n'));
    } else {
      console.log(chalk.bold.red(`✖ API Test Failed:\n${testRes.error}\n`));
    }
  } else if (choice === 'update') {
    const newKey = await promptApiKey();
    console.log(chalk.cyan('Validating new API key...'));
    const testRes = await GooglePlacesService.validateApiKey(newKey);
    if (testRes.valid) {
      setApiKey(newKey, true);
      console.log(chalk.bold.green('✔ New API key validated and saved successfully!\n'));
    } else {
      console.log(chalk.bold.red(`✖ Invalid API Key: ${testRes.error}`));
    }
  }
}

async function executeSearch(criteria: SearchCriteria): Promise<void> {
  const start = await promptConfirmStart();
  if (!start) {
    console.log(chalk.yellow('Search cancelled. Returning to menu.\n'));
    return;
  }

  const presetName = await promptSaveAsPreset();
  if (presetName) {
    await HistoryService.saveConfig({
      ...criteria,
      name: presetName,
      createdAt: new Date().toISOString(),
    });
    console.log(chalk.green(`✔ Saved configuration preset: "${presetName}"`));
  }

  const progressRenderer = new ProgressRenderer();
  const collector = new LeadCollectorService();
  activeCollector = collector;

  try {
    const outcome = await collector.runSearchWorkflow(criteria, (stats) => {
      progressRenderer.renderProgress(criteria, stats);
    });

    ProgressRenderer.renderCompletionSummary({
      criteria,
      results: outcome.results,
      combinedExport: outcome.combinedExport,
      totalUniqueLeads: outcome.totalUniqueLeads,
    });
  } catch (err: any) {
    console.log(chalk.red(`\nSearch encountered an error: ${err.message}`));
    logger.error({ err }, 'Search run error');
  } finally {
    activeCollector = null;
  }
}

async function handleNewSearch(isMulti: boolean): Promise<void> {
  const categories = await promptCategories(true);
  const locations = await promptLocations(isMulti);
  const radiusKm = await promptRadius();
  const targetLeads = await promptTargetLeads();
  const fields = await promptFieldsToCollect();
  const filters = await promptQualityFilters();
  const outputFormat = await promptOutputFormat();

  const criteria: SearchCriteria = {
    id: `search_${Date.now()}`,
    locations,
    categories,
    radiusKm,
    targetLeads,
    fields,
    filters,
    outputFormat,
    combineMultiLocations: locations.length > 1,
    createdAt: new Date().toISOString(),
  };

  await executeSearch(criteria);
}

async function handleHistory(): Promise<void> {
  const history = await HistoryService.getHistory();
  if (history.length === 0) {
    console.log(chalk.yellow('\nNo previous searches recorded yet.\n'));
    return;
  }

  const choices = history.slice(0, 15).map((entry, idx) => {
    const dateStr = new Date(entry.timestamp).toLocaleString();
    const locs = entry.criteria.locations.join(', ');
    const cats = entry.criteria.categories.join(', ');
    return {
      name: `${dateStr} | ${chalk.cyan(locs)} | ${chalk.yellow(cats)} (${chalk.green(`${entry.resultsCount} leads`)})`,
      value: entry.id,
    };
  });

  choices.push({ name: chalk.gray('← Back to Main Menu'), value: 'back' });

  const selectedId = await select({
    message: 'Select a past search to rerun or inspect:',
    choices,
  });

  if (selectedId === 'back') return;

  const entry = history.find((h) => h.id === selectedId);
  if (!entry) return;

  console.log(chalk.bold('\nSearch Details:'));
  console.log(`• Date:       ${new Date(entry.timestamp).toLocaleString()}`);
  console.log(`• Locations:  ${entry.criteria.locations.join(', ')}`);
  console.log(`• Categories: ${entry.criteria.categories.join(', ')}`);
  console.log(`• Target:     ${entry.criteria.targetLeads}`);
  console.log(`• Found:      ${entry.resultsCount}`);
  if (entry.outputFiles.length > 0) {
    console.log(`• Output:     ${entry.outputFiles.join('\n              ')}`);
  }

  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Rerun this search now', value: 'rerun' },
      { name: 'Back to history list', value: 'back' },
    ],
  });

  if (action === 'rerun') {
    await executeSearch({
      ...entry.criteria,
      id: `rerun_${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
  }
}

async function handlePresets(): Promise<void> {
  const presets = await HistoryService.getSavedConfigs();
  if (presets.length === 0) {
    console.log(chalk.yellow('\nNo saved presets found. You can save presets after configuring a search.\n'));
    return;
  }

  const choices = presets.map((p) => ({
    name: `${chalk.bold.magenta(p.name || 'Untitled')} (${p.locations.join(', ')} - ${p.categories.join(', ')})`,
    value: p.name || p.id || '',
  }));
  choices.push({ name: chalk.gray('← Back to Main Menu'), value: 'back' });

  const chosen = await select({
    message: 'Select a saved configuration to run:',
    choices,
  });

  if (chosen === 'back') return;

  const preset = presets.find((p) => p.name === chosen || p.id === chosen);
  if (preset) {
    await executeSearch(preset);
  }
}

async function main(): Promise<void> {
  ensureDirectories();
  showWelcomeBanner();

  const keyReady = await ensureValidApiKey();
  if (!keyReady) {
    console.log(chalk.yellow('Note: You can configure the API key anytime from the main menu.\n'));
  }

  let running = true;
  while (running) {
    try {
      const action = await promptMainMenu();

      switch (action) {
        case 'quick':
          await handleNewSearch(false);
          break;
        case 'multi':
          await handleNewSearch(true);
          break;
        case 'history':
          await handleHistory();
          break;
        case 'presets':
          await handlePresets();
          break;
        case 'apikey':
          await handleConfigureApiKey();
          break;
        case 'exit':
          running = false;
          console.log(chalk.bold.cyan('\nThank you for using Google Maps Lead Generator. Goodbye!\n'));
          break;
      }
    } catch (err: any) {
      if (err.name === 'ExitPromptError') {
        // User pressed Ctrl+C inside an inquirer prompt
        console.log(chalk.gray('\nOperation cancelled.'));
      } else {
        console.error(chalk.red(`\nAn error occurred: ${err.message}`));
        logger.error({ err }, 'CLI main loop error');
      }
    }
  }
}

main().catch((err) => {
  console.error(chalk.red('Fatal application error:'), err);
  process.exit(1);
});
