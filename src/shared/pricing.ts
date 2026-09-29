/**
 * Usage pricing (design §15.2).
 *
 * Agents run on subscriptions, so cost is an API-equivalent VALUATION; the headline is share of
 * observed fleet spend. Per-model input/output $/MTok with longest-prefix model matching (dated
 * snapshot ids); cache read 0.1x, 5m write 1.25x, 1h write 2x. Unknown model -> null cost, never
 * zero. Provider-reported cost (OpenRouter) overrides the table and is flagged as a receipt.
 */

export interface ModelPrice {
  /** dollars per million input tokens. */
  inputPerMTok: number;
  /** dollars per million output tokens. */
  outputPerMTok: number;
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

export const CACHE_READ_MULTIPLIER = 0.1;
export const CACHE_WRITE_5M_MULTIPLIER = 1.25;
export const CACHE_WRITE_1H_MULTIPLIER = 2.0;

/**
 * The price table, keyed by model-id prefix. Populate from a maintained source.
 * TODO(step 8): fill in the model price table.
 */
export const PRICE_TABLE: Record<string, ModelPrice> = {};

/** Longest-prefix match a model id against the price table (design §15.2). */
export function priceForModel(_modelId: string): ModelPrice | null {
  throw new Error("pricing.priceForModel: not implemented (design §15.2)");
}

/**
 * Value token counts in micros. Returns null when the model is unknown (never zero).
 * TODO(step 8): implement with the cache multipliers.
 */
export function valuate(_modelId: string, _tokens: TokenCounts): number | null {
  throw new Error("pricing.valuate: not implemented (design §15.2)");
}
