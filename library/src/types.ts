import type * as v from "valibot";
import type { LocaleDefinition, Faker, Randomizer } from "@faker-js/faker";

/**
 * Configuration for the mock generator
 */
export interface MockGeneratorOptions {
  /**
   * Faker configuration
   */
  faker?: {
    locale: LocaleDefinition | LocaleDefinition[];
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
}

/**
 * Internal resolved options with Faker instance
 */
export interface ResolvedMockGeneratorOptions {
  faker: Faker;
  maxAttempts: number;
  defaultArrayMaxLength: number;
  defaultStringMaxLength: number;
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
   * Generate a single mocked value based on the schema
   */
  generate(): v.InferOutput<TSchema>;
  
  /**
   * Generate multiple mocked values
   */
  generateMany(count: number): v.InferOutput<TSchema>[];
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