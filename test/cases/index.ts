import * as path from 'path';
import * as fs from 'fs';

export function loadTestCase(testName: string) {
  const inputPath = path.join(__dirname, `${testName}.yaml`);
  const inputText = fs.readFileSync(inputPath, { encoding: 'utf-8' });

  return inputText;
}
