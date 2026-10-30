import boxen from 'boxen';
import chalk from 'chalk';
import { getApiKey, maskApiKey } from '../config/env.js';

export function showWelcomeBanner(): void {
  const currentKey = getApiKey();
  const maskedKey = currentKey ? chalk.green(maskApiKey(currentKey)) : chalk.yellow('NOT CONFIGURED');

  const title = chalk.bold.cyan('MAPS LEAD GENERATOR');
  const subtitle = chalk.white('B2B Lead Generation & Intelligence CLI via Google Places API (New)');
  const keyInfo = chalk.gray(`API Key Status: ${maskedKey}`);

  const content = `
${title}
${subtitle}

${keyInfo}
${chalk.gray('Compliance:')} Official Places API • Field-Mask Cost Optimized • Automatic Deduplication
  `.trim();

  console.log(
    boxen(content, {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
      textAlignment: 'center',
    })
  );

  console.log(
    chalk.italic.gray(
      'Notice: Collects authorized public business data. Missing fields are left blank. No web scraping.\n'
    )
  );
}

export function showComplianceNotice(): void {
  const notice = chalk.dim(
    `[Google Maps Compliance] This CLI uses Google Places API (New) with field masks to minimize API costs.\nGoogle terms prohibit storing data beyond authorized limits. Place IDs are preserved for reference.`
  );
  console.log(notice + '\n');
}
