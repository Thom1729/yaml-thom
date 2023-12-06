export type Strategy<TReturn, TArgs extends readonly unknown[]> = (...args: TArgs) => TReturn | undefined;
export type Strategies<TReturn, TArgs extends readonly unknown[]> = Record<PropertyKey, Strategy<TReturn, TArgs>>;

export type StrategyOptions<
  TAliases extends Strategies<unknown, never>
> = TAliases extends Record<infer TAlias, infer TStrategy>
  ? Iterable<TStrategy | TAlias>
  : never;

export function applyStrategy<
  TReturn,
  TArgs extends readonly unknown[],
  TAlias extends PropertyKey,
>(
  aliases: Record<TAlias, Strategy<TReturn, TArgs>>,
  values: StrategyOptions<Record<TAlias, Strategy<TReturn, TArgs>>>,
  value: TArgs,
): TReturn | undefined {
  for (const strategy of iterateStrategies(aliases, values)) {
    const result = strategy(...value);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

function *iterateStrategies<
  TStrategy extends Strategy<unknown, never>,
  TAlias extends PropertyKey,
>(
  aliases: Record<TAlias, TStrategy>,
  values: StrategyOptions<Record<TAlias, TStrategy>>,
): Generator<TStrategy> {
  for (const value of values) {
    if (typeof value === 'function') {
      yield value as TStrategy;
    } else {
      yield aliases[value as TAlias] as TStrategy;
    }
  }
}
