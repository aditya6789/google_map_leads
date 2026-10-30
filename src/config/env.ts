import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env if present
dotenv.config();

const envSchema = z.object({
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  DEFAULT_SEARCH_RADIUS: z.coerce.number().positive().optional().default(5000),
  MAX_RETRIES: z.coerce.number().nonnegative().optional().default(3),
  RETRY_DELAY_MS: z.coerce.number().positive().optional().default(1000),
  REQUEST_TIMEOUT_MS: z.coerce.number().positive().optional().default(15000),
  OUTPUT_DIR: z.string().optional().default('output'),
  HISTORY_DIR: z.string().optional().default('history'),
  LOGS_DIR: z.string().optional().default('logs'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const env = {
  ...parsed.data,
  OUTPUT_DIR: path.resolve(process.cwd(), parsed.data.OUTPUT_DIR),
  HISTORY_DIR: path.resolve(process.cwd(), parsed.data.HISTORY_DIR),
  LOGS_DIR: path.resolve(process.cwd(), parsed.data.LOGS_DIR),
};

export function getApiKey(): string {
  return env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

export function setApiKey(newKey: string, persistToFile = true): void {
  const trimmed = newKey.trim();
  env.GOOGLE_MAPS_API_KEY = trimmed;
  process.env.GOOGLE_MAPS_API_KEY = trimmed;

  if (persistToFile) {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
      if (/GOOGLE_MAPS_API_KEY=.*/.test(content)) {
        content = content.replace(/GOOGLE_MAPS_API_KEY=.*/, `GOOGLE_MAPS_API_KEY=${trimmed}`);
      } else {
        content += `\nGOOGLE_MAPS_API_KEY=${trimmed}\n`;
      }
    } else {
      content = `# Google Maps Platform API Key\nGOOGLE_MAPS_API_KEY=${trimmed}\nLOG_LEVEL=info\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
  }
}

export function maskApiKey(key: string): string {
  if (!key) return '(not configured)';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function ensureDirectories(): void {
  for (const dir of [env.OUTPUT_DIR, env.HISTORY_DIR, env.LOGS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
