import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Config, Office, Resource } from './types.js';

const CONFIG_PATHS = [
  './deskbird.json',
  './config/deskbird.json',
  '../deskbird.json',
];

interface ConfigFile {
  apiKey?: string;
  baseUrl?: string;
  defaultOfficeId?: string;
  timezone?: string;
}

/**
 * Load configuration from file and environment
 */
export function loadConfig(): Config {
  const apiKey = process.env.DESKBIRD_API_KEY;
  if (!apiKey) {
    throw new Error(
      'DESKBIRD_API_KEY environment variable is required.\n' +
      'Get your API key from the Deskbird app: Settings > Integrations > API'
    );
  }

  let fileConfig: ConfigFile = {};

  // Try to load config file
  for (const configPath of CONFIG_PATHS) {
    const fullPath = resolve(configPath);
    if (existsSync(fullPath)) {
      try {
        fileConfig = JSON.parse(readFileSync(fullPath, 'utf-8'));
        break;
      } catch {
        // Ignore parse errors, continue to next path
      }
    }
  }

  return {
    apiKey,
    baseUrl: process.env.DESKBIRD_BASE_URL || fileConfig.baseUrl || 'https://connect.deskbird.com',
    defaultOfficeId: process.env.DESKBIRD_OFFICE_ID || fileConfig.defaultOfficeId,
    timezone: process.env.TZ || fileConfig.timezone || 'Europe/Madrid',
  };
}

// Cache for offices and resources
let officesCache: Office[] | null = null;
let resourcesCache: Map<string, Resource[]> = new Map();

export function setOfficesCache(offices: Office[]): void {
  officesCache = offices;
}

export function getOfficesCache(): Office[] | null {
  return officesCache;
}

export function setResourcesCache(officeId: string, resources: Resource[]): void {
  resourcesCache.set(officeId, resources);
}

export function getResourcesCache(officeId: string): Resource[] | null {
  return resourcesCache.get(officeId) || null;
}
