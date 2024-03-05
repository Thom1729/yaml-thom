import path from 'path';
import { fileURLToPath } from 'url';

export const BASE_PATH = path.join(fileURLToPath(import.meta.url), '..', '..');
