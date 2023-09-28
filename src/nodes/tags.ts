const QUESTION: unique symbol = Symbol.for('?');
const EXCLAMATION: unique symbol = Symbol.for('!');

export const NonSpecificTag = {
  question: QUESTION,
  exclamation: EXCLAMATION,
} as const;

export type NonSpecificTag = (typeof NonSpecificTag)[keyof typeof NonSpecificTag];
