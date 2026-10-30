import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import { SearchCriteria, SearchHistoryEntry } from '../../types/lead.types.js';
import { logger } from '../../utils/logger.js';

export class HistoryService {
  private static historyFile = path.join(env.HISTORY_DIR, 'search_history.json');
  private static savedConfigsFile = path.join(env.HISTORY_DIR, 'saved_configs.json');

  private static async ensureFilesExist(): Promise<void> {
    if (!fsSync.existsSync(env.HISTORY_DIR)) {
      await fs.mkdir(env.HISTORY_DIR, { recursive: true });
    }
    if (!fsSync.existsSync(this.historyFile)) {
      await fs.writeFile(this.historyFile, '[]', 'utf8');
    }
    if (!fsSync.existsSync(this.savedConfigsFile)) {
      await fs.writeFile(this.savedConfigsFile, '[]', 'utf8');
    }
  }

  public static async getHistory(): Promise<SearchHistoryEntry[]> {
    try {
      await this.ensureFilesExist();
      const content = await fs.readFile(this.historyFile, 'utf8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      logger.error({ err }, 'Error reading search history');
      return [];
    }
  }

  public static async saveHistoryEntry(entry: SearchHistoryEntry): Promise<void> {
    try {
      const history = await this.getHistory();
      // Prepend newest first, keeping last 100 entries
      history.unshift(entry);
      if (history.length > 100) {
        history.length = 100;
      }
      await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2), 'utf8');
    } catch (err) {
      logger.error({ err }, 'Error saving history entry');
    }
  }

  public static async getSavedConfigs(): Promise<SearchCriteria[]> {
    try {
      await this.ensureFilesExist();
      const content = await fs.readFile(this.savedConfigsFile, 'utf8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      logger.error({ err }, 'Error reading saved configs');
      return [];
    }
  }

  public static async saveConfig(config: SearchCriteria): Promise<void> {
    try {
      const configs = await this.getSavedConfigs();
      const index = configs.findIndex((c) => c.id === config.id || (c.name && c.name === config.name));
      if (index >= 0) {
        configs[index] = config;
      } else {
        configs.unshift(config);
      }
      await fs.writeFile(this.savedConfigsFile, JSON.stringify(configs, null, 2), 'utf8');
    } catch (err) {
      logger.error({ err }, 'Error saving config');
    }
  }
}
