import type * as v from "valibot";
import type { LocaleDefinition, Faker, Randomizer } from "@faker-js/faker";
import type { SemanticGenerator } from "./semantics.ts";

/**
 * Sentinel a `resolve` hook returns to decline a node (falls through to
 * normal generation). Distinct from the internal `VOID`: declining a node
 * and resolving it to an absent optional are different answers.
 */
export const SKIP: unique symbol = Symbol("valibot-mock/skip");

/**
 * A single schema node offered to the caller's `resolve` hook.
 */
export interface ResolveNode {
  /**
   * The schema at this node, already unwrapped so validation constraints
   * (e.g. a RegExp `requirement`) are visible in `schema.pipe`. Typed
   * `unknown` — reading it means reading valibot internals; narrow it yourself.
   */
  schema: unknown;
  /**
   * Dot-separated path from the root (`""` at the root), indices included
   * (`"users.0.id"`). Wrapper nodes (`optional`, `union`…) share the path of
   * the value they wrap and are offered first, so the first match wins.
   */
  path: string;
  /**
   * The generator's faker instance, already seeded. Any randomness inside the
   * hook (e.g. picking one of N existing ids) should go through it so a seed
   * keeps the whole generation reproducible.
   */
  faker: Faker;
}

/**
 * Configuration for the mock generator
 */
export interface MockGeneratorOptions {
  /**
   * Faker configuration
   */
  faker?: {
    /** Defaults to English when omitted (partial options are merged). */
    locale?: LocaleDefinition | LocaleDefinition[];
    randomizer?: Randomizer;
    seed?: number;
  };

  /**
   * Maximum number of attempts to generate a valid value
   * @default 10
   */
  maxAttempts?: number;

  /**
   * Default maximum length for arrays
   * @default 10
   */
  defaultArrayMaxLength?: number;

  /**
   * Default maximum length for randomly generated strings
   * @default 1048575 (2^20 - 1)
   */
  defaultStringMaxLength?: number;

  /**
   * Semantic field-name generation for plain strings: an entry key like
   * `firstname` or `email` yields a realistic value instead of random
   * alphanumerics. `false` disables the tier entirely; a record EXTENDS or
   * overrides the built-in table (normalized keys — see
   * `normalizeSemanticKey`). Explicit `fake()` metadata and validator pipes
   * (`v.email()`, `v.regex()`…) always take precedence.
   * @default built-in table (DEFAULT_SEMANTICS)
   */
  semantics?: false | Readonly<Record<string, SemanticGenerator>>;

  /**
   * Caller-side hook consulted at every node (any depth), ranked above
   * fake() and semantics. Return {@link SKIP} to fall through; a resolved
   * value is validated like generated ones and its subtree is not visited.
   */
  resolve?: (node: ResolveNode) => unknown;
}

/**
 * Internal resolved options with Faker instance
 */
export interface ResolvedMockGeneratorOptions {
  faker: Faker;
  maxAttempts: number;
  defaultArrayMaxLength: number;
  defaultStringMaxLength: number;
  /** null = tier disabled; a record = consumer table merged over defaults at resolve time. */
  semantics: Readonly<Record<string, SemanticGenerator>> | null;
  /** null = no caller-side hook. */
  resolve: ((node: ResolveNode) => unknown) | null;
}

/**
 * Shared generation context between handlers. `path` is the dot-separated
 * location from the root (indices included, `""` at the root) — the same
 * string handed to `resolve` hooks.
 */
export interface GenerationContext {
  path: string;
}

/**
 * Main interface for the mock generator
 */
export interface MockGenerator<TSchema extends v.GenericSchema> {
  /**
   * Generate a single mocked value based on the schema.
   *
   * @param overrides For object schemas, values that REPLACE the corresponding
   * generated top-level fields — the first-class way to inject
   * referential-integrity values (existing ids), fixed enums, or any
   * caller-controlled value.
   */
  generate(overrides?: Partial<v.InferOutput<TSchema>>): v.InferOutput<TSchema>;

  /**
   * Generate multiple mocked values.
   *
   * @param overrides Applied to every item, or a function producing per-index
   * overrides (e.g. a distinct existing id per row).
   */
  generateMany(
    count: number,
    overrides?:
      | Partial<v.InferOutput<TSchema>>
      | ((index: number) => Partial<v.InferOutput<TSchema>>),
  ): v.InferOutput<TSchema>[];
}

/**
 * Symbol used to represent optional values that are not present
 */
export const VOID = Symbol("void");

/**
 * Type helper for values that can be VOID
 */
export type MaybeVoid<T> = T | typeof VOID;

/**
 * Symbol used to mark schemas with custom fake generators
 */
export const FAKE_GENERATOR = Symbol("fake_generator");

/**
 * Type for custom fake generator function
 */
export type FakeGeneratorFn<T> = (
  faker: Faker,
  context: GenerationContext,
) => T;

/**
 * Metadata interface for fake generators
 */
export interface FakeGeneratorMetadata<T> {
  [FAKE_GENERATOR]: FakeGeneratorFn<T>;
}
