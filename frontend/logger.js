// logger.js
import path from 'path';
import { fileURLToPath } from 'url';

export function createLogger(metaUrl) {
  const filename = path.basename(fileURLToPath(metaUrl));
  return {
    log: (...args) => console.log(`[${filename}]`, ...args),
    error: (...args) => console.error(`[${filename}]`, ...args)
  };
}