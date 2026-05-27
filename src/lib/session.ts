import fs from 'fs';
import path from 'path';
import { AppConfig } from '../types';

const CONFIG_PATH = path.resolve(__dirname, '../../config.json');
const RESULTS_DIR = path.resolve(__dirname, '../../data/results');

export function loadConfig(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      'config.json not found — run: cp config.example.json config.json and edit it'
    );
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw) as AppConfig;
}

export function saveResults(filename: string, data: unknown): string {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const filePath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}
