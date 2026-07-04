import type * as v from "valibot";
import type { LocaleDefinition, Faker, Randomizer } from "@faker-js/faker";
import type { SemanticGenerator } from "./semantics.ts";

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
}

/**
 * Shared generation context between handlers
 */
export interface GenerationContext {
  depth: number;
  path: string[];
  references: Map<string, unknown>;
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