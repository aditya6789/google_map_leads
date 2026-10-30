import path from 'node:path';
import fs from 'node:fs';
import pino from 'pino';
import { env, maskApiKey } from '../config/env.js';

if (!fs.existsSync(env.LOGS_DIR)) {
  fs.mkdirSync(env.LOGS_DIR, { recursive: true });
}

const logFile = path.join(env.LOGS_DIR, 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'apiKey',
        'key',
        'GOOGLE_MAPS_API_KEY',
        'headers["X-Goog-Api-Key"]',
        'headers["x-goog-api-key"]',
        'config.headers["X-Goog-Api-Key"]',
      ],
      censor: '***REDACTED_API_KEY***',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  logStream
);

export function safeLog(msg: string, meta?: Record<string, unknown>): void {
  const sanitizedMeta = meta ? JSON.parse(JSON.stringify(meta)) : undefined;
  if (sanitizedMeta?.apiKey && typeof sanitizedMeta.apiKey === 'string') {
    sanitizedMeta.apiKey = maskApiKey(sanitizedMeta.apiKey);
  }
  logger.info(sanitizedMeta, msg);
}
