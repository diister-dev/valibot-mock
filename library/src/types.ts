import type * as v from "valibot";
import type { LocaleDefinition, Faker, Randomizer } from "@faker-js/faker";
import type { SemanticGenerator } from "./semantics.ts";

/**
 * Sentinel returned by a `resolve` hook to decline a node: "I do not provide
 * this value — generate it normally". A dedicated symbol (not the internal
 * `VOID`) because declining a node and resolving it to an absent optional are
 * different answers, and the two channels must stay distinguishable.
 */
export const SKIP: unique symbol = Symbol("valibot-mock/skip");

/**
 * A single schema node offered to the caller's `resolve` hook.
 */
export interface ResolveNode {
  /**
   * The schema at this node, already unwrapped: nested pipes are flattened,
   * so validation constraints are directly visible in `schema.pipe` (e.g. a
   * `requirement: RegExp` for regex-backed actions). Typed `unknown` because
   * inspecting it means reading valibot internals — narrow it on your side.
   */
  schema: unknown;
  /**
   * Dot-separated path from the root (`""` at the root itself). Array and
   * tuple indices are included: `"users.0.id"`. Wrapper nodes (`optional`,
   * `nullable`, `union`…) share the path of the value they wrap; the wrapper
   * is offered first, so the first match wins.
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
   * Caller-side resolution hook, consulted at EVERY node — any depth,
   * wrapper nodes included — before anything else. Precedence: `resolve` >
   * `fake()` metadata > semantics > default generation. The hook belongs to
   * the CALLER, who has generation-time knowledge the schema author cannot
   * have (correlated ids across collections, fixed foreign keys…), while
   * `fake()` is a definition-time default; returning {@link SKIP} declines
   * the node and falls through to those channels, so no expressiveness is
   * lost by ranking the hook first.
   *
   * A resolved value goes through the SAME `v.safeParse` gate as generated
   * values; an invalid value THROWS with the node's path (unlike
   * `generate(overrides)`, which spreads after validation). When an
   * object/array node is resolved, its subtree is NOT visited — the resolved
   * value covers it whole.
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
 * Shared generation context between handlers.
 *
 * `path` is the dot-separated location from the root, indices included
 * (`"users.0.id"`, `""` at the root) — the same string handed to `resolve`
 * hooks. Former declared fields `depth`/`references` were never populated at
 * runtime (any read yielded `undefined` despite the type), so they were
 * removed rather than kept as a lie.
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
    overrides?: Partial<v.InferOutput<TSchema>> | ((index: number) => Partial<v.InferOutput<TSchema>>),
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
export type FakeGeneratorFn<T> = (faker: Faker, context: GenerationContext) => T;

/**
 * Metadata interface for fake generators
 */
export interface FakeGeneratorMetadata<T> {
  [FAKE_GENERATOR]: FakeGeneratorFn<T>;
}