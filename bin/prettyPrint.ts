import { command, readStream } from './util';

import { logger } from './util';

export const prettyPrint = command<{
  file: string
}>(async ({ file }) => {
  const stream = readStream(file);
  for await (const doc of stream) {
    logger.dir(doc);
  }
});
