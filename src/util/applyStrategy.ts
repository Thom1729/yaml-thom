import { isArray } from './typeAssertions';

export type Strategy<TReturn, TArgs extends readonly unknown[]> = (...args: TArgs) => TReturn | undefined;
export type Strategies<TReturn, TArgs extends readonly unknown[]> = Record<PropertyKey, Strategy<TReturn, TArgs>>;

export type StrategyOptions<
  TAliases extends Strategies<unknown, never>
> = _StrategyOptions<TAliases[keyof TAliases], keyof TAliases>;

type _StrategyOptions<
  TStrategy extends Strategy<unknown, never>,
  TAlias extends PropertyKey,
> =
| TAlias
| TStrategy
| readonly _StrategyOptions<TStrategy, TAlias>[];

export function applyStrategy<
  TReturn,
  TArgs extends readonly unknown[],
  TAlias extends PropertyKey,
>(
  aliases: Record<TAlias, Strategy<TReturn, TArgs>>,
  values: _StrategyOptions<Strategy<TReturn, TArgs>, TAlias>,
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
  value: _StrategyOptions<TStrategy, TAlias>,
): Generator<TStrategy> {
  if (isArray(value)) {
    for (const item of value) {
      yield* iterateStrategies(aliases, item);
    }
  } else if (typeof value === 'function') {
    yield value;
  } else {
    yield aliases[value];
  }
}
