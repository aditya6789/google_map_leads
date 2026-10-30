import chalk from 'chalk';
import Table from 'cli-table3';
import { SearchProgressStats, SearchCriteria } from '../types/lead.types.js';
import { LocationSearchResult } from '../services/lead-collector.service.js';
import { ExportResult } from '../services/export.service.js';

export class ProgressRenderer {
  private lastRenderedLines = 0;

  /**
   * Renders the interactive search in-progress display.
   */
  public renderProgress(criteria: SearchCriteria, stats: SearchProgressStats): void {
    const width = 24;
    const filledCount = Math.round((stats.percent / 100) * width);
    const emptyCount = Math.max(0, width - filledCount);
    const progressBar = chalk.green('█'.repeat(filledCount)) + chalk.gray('░'.repeat(emptyCount));

    const lines = [
      chalk.cyan('===================================================='),
      chalk.bold.yellow('                 SEARCH IN PROGRESS                 '),
      chalk.cyan('===================================================='),
      '',
      `${chalk.bold('Location:')}       ${stats.currentLocation || criteria.locations[0]} (${stats.locationIndex}/${stats.totalLocations})`,
      `${chalk.bold('Category:')}       ${stats.currentCategory || criteria.categories[0]} (${stats.categoryIndex}/${stats.totalCategories})`,
      `${chalk.bold('Radius:')}         ${criteria.radiusKm} KM`,
      `${chalk.bold('Target Leads:')}   ${criteria.targetLeads}`,
      '',
      `[${progressBar}] ${chalk.bold.cyan(`${stats.percent}%`)}`,
      '',
      `${chalk.white('Businesses Found:')}     ${chalk.yellow(stats.totalFound)}`,
      `${chalk.white('Unique Businesses:')}   ${chalk.green(stats.uniqueLeads)}`,
      `${chalk.white('Duplicates Removed:')}   ${chalk.red(stats.duplicatesRemoved)}`,
      `${chalk.white('Filtered Out:')}        ${chalk.magenta(stats.filteredOut)}`,
      `${chalk.white('Phone Numbers Found:')} ${chalk.cyan(stats.phoneNumbersFound)}`,
      `${chalk.white('Websites Found:')}      ${chalk.blue(stats.websitesFound)}`,
      '',
      chalk.italic.gray(stats.statusMessage || 'Processing...'),
      chalk.cyan('===================================================='),
    ];

    // Clear previous lines if stdout is a TTY
    if (process.stdout.isTTY) {
      process.stdout.write('\x1Bc'); // clear screen
    }
    console.log(lines.join('\n'));
  }

  /**
   * Displays the final completion screen with summary table and file paths.
   */
  public static renderCompletionSummary(params: {
    criteria: SearchCriteria;
    results: LocationSearchResult[];
    combinedExport?: ExportResult;
    totalUniqueLeads: number;
  }): void {
    const { criteria, results, combinedExport, totalUniqueLeads } = params;

    let grandTotalFound = 0;
    let grandDuplicates = 0;
    let grandFiltered = 0;
    let grandPhones = 0;
    let grandWebsites = 0;

    results.forEach((r) => {
      grandTotalFound += r.stats.totalFound;
      grandDuplicates += r.stats.duplicatesRemoved;
      grandFiltered += r.stats.filteredOut;
      grandPhones += r.stats.phoneNumbersFound;
      grandWebsites += r.stats.websitesFound;
    });

    console.log('\n' + chalk.cyan('===================================================='));
    console.log(chalk.bold.green('                  SEARCH COMPLETED                  '));
    console.log(chalk.cyan('====================================================\n'));

    // CLI Table for summary
    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [26, 26],
    });

    table.push(
      ['Target Leads', String(criteria.targetLeads * criteria.locations.length)],
      ['Total Businesses Fetched', String(grandTotalFound)],
      ['Unique Leads Collected', chalk.green(String(totalUniqueLeads))],
      ['Duplicates Filtered Out', chalk.yellow(String(grandDuplicates))],
      ['Quality Filters Removed', chalk.magenta(String(grandFiltered))],
      ['Phone Numbers Found', chalk.cyan(String(grandPhones))],
      ['Websites Found', chalk.blue(String(grandWebsites))]
    );

    console.log(table.toString());
    console.log('');

    const encounteredErrors = results.map((r) => r.error).filter(Boolean);
    if (totalUniqueLeads === 0 && encounteredErrors.length > 0) {
      console.log(chalk.bold.red('✖ Search failed to collect leads due to Google API permission / configuration error:'));
      encounteredErrors.forEach((err) => console.log(chalk.red(`  • ${err}`)));
      console.log(chalk.yellow('\nHow to fix this issue:'));
      console.log(chalk.white('  1. Enable "Places API (New)" on your Google Cloud project:'));
      console.log(chalk.cyan('     https://console.developers.google.com/apis/api/places.googleapis.com/overview'));
      console.log(chalk.white('  2. Enable Billing on your project (Google provides $200 free credit monthly):'));
      console.log(chalk.cyan('     https://console.cloud.google.com/project/_/billing/enable'));
      console.log(chalk.white('  3. In "APIs & Services > Credentials", ensure your API key has permission for Places API (New).\n'));
    } else {
      console.log(chalk.bold('Generated Output Files:'));
      results.forEach((res) => {
        console.log(chalk.gray(`• Location: ${res.location}`));
        if (res.exportResult.excelPath) {
          console.log(`  ${chalk.green('Excel:')} ${chalk.underline(res.exportResult.excelPath)}`);
        }
        if (res.exportResult.csvPath) {
          console.log(`  ${chalk.cyan('CSV:')}   ${chalk.underline(res.exportResult.csvPath)}`);
        }
      });

      if (combinedExport) {
        console.log(chalk.bold.yellow('\nCombined Master File (All Locations):'));
        if (combinedExport.excelPath) {
          console.log(`  ${chalk.green('Excel:')} ${chalk.underline(combinedExport.excelPath)}`);
        }
        if (combinedExport.csvPath) {
          console.log(`  ${chalk.cyan('CSV:')}   ${chalk.underline(combinedExport.csvPath)}`);
        }
      }

      console.log('\n' + chalk.bold.green('✔ Lead generation finished successfully!'));
    }
    console.log(chalk.cyan('====================================================\n'));
  }
}
