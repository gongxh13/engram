import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { EvalSession } from './schema.js';

const DEFAULT_DATA_DIR = join(homedir(), '.engram');
const DEFAULT_DATA_FILE = 'sessions.jsonl';

function getDataPath(customPath?: string): string {
  const dir = customPath || process.env.ENGRAM_DATA_DIR || DEFAULT_DATA_DIR;
  return join(dir, DEFAULT_DATA_FILE);
}

function ensureDirectory(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function appendSession(session: EvalSession, path?: string): void {
  const filePath = getDataPath(path);
  ensureDirectory(filePath);
  const line = JSON.stringify(session) + '\n';
  appendFileSync(filePath, line, 'utf-8');
}

export function readSessions(path?: string): EvalSession[] {
  const filePath = getDataPath(path);
  
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  return lines.map(line => JSON.parse(line) as EvalSession);
}

export function getStoragePath(customPath?: string): string {
  return getDataPath(customPath);
}
