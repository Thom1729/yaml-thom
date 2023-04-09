import path from 'path';
import fs from 'fs';

export function loadText(...pathComponents: string[]) {
  const inputPath = path.join(__dirname, ...pathComponents);
  return fs.readFileSync(inputPath, { encoding: 'utf-8' });
}
