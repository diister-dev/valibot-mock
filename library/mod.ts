/**
  * @example Basic usage
 * ```ts
 * import * v from "valibot";
 * import { createMockGenerator } from "@diister/valibot-mock";
 * 
 * const UserSchema = v.object({
 *   name: v.string(),
 *   age: v.number(),
 *   email: v.pipe(v.string(), v.email())
 * });
 * 
 * const generator = createMockGenerator(UserSchema);
 * const mockUser = generator.generate();
 * console.log(mockUser); // { name: "John", age: 25, email: "john@example.com" }
 * ```
 * 
 * @example With custom fake generator
 * ```ts
 * import * as v from "valibot";
 * import { createMockGenerator, fake, locales } from "@diister/valibot-mock";bot Mock Generator - Generate realistic mock data from Valibot schemas
 * 
 * This package allows generating valid test data from Valibot schemas
 * using Faker.js to create realistic values.
 * 
 * @example Basic usage
 * ```ts
 * import * as v from "valibot";
 * import { createMockGenerator } from "@valibot-mock/core";
 * 
 * const UserSchema = v.object({
 *   name: v.string(),
 *   age: v.number(),
 *   email: v.pipe(v.string(), v.email())
 * });
 * 
 * const generator = createMockGenerator(UserSchema);
 * const mockUser = generator.generate();
 * console.log(mockUser); // { name: "John", age: 25, email: "john@example.com" }
 * ```
 * 
 * @example With custom fake generator
 * ```ts
 * import * as v from "valibot";
 * import { createMockGenerator, fake, locales } from "@valibot-mock/core";
 * 
 * const UserSchema = v.object({
 *   name: v.pipe(v.string(), v.maxLength(50), fake((f) => f.person.firstName())),
 *   email: v.pipe(v.string(), v.email(), fake((f) => f.internet.email()))
 * });
 * 
 * const generator = createMockGenerator(UserSchema, {
 *   faker: { locale: [locales.fr, locales.en] }
 * });
 * ```
 * 
 * @example With custom locale
 * ```ts
 * import { createMockGenerator, locales } from "@diister/valibot-mock";
 * 
 * const generator = createMockGenerator(UserSchema, {
 *   faker: {
 *     locale: [locales.fr, locales.en],
 *     seed: 42
 *   }
 * });
 * ```
 * 
 * @module
 */

export {
  createMockGenerator,
} from "./src/generator.ts";

// Re-export utility types and functions
export type { VOID, FakeGeneratorFn } from "./src/types.ts";
export { fake } from "./src/fake.ts";

// Export commonly used Faker locales for convenience
import { 
  en, fr, es, de, it, ru, ja, ko, zh_CN as zh, 
  ar, nl, sv, da, fi, pl, tr, th 
} from "@faker-js/faker";

/**
 * Collection of common locale definitions for Faker.js
 * These can be used directly with the MockGeneratorOptions.
 * 
 * @example
 * ```typescript
 * import { createMockGenerator, locales } from "@diister/valibot-mock";
 * 
 * const generator = createMockGenerator(mySchema, {
 *   faker: {
 *     locale: [locales.fr, locales.en]
 *   }
 * });
 * ```
 */
export const locales = {
  /** English locale */
  en,
  /** French locale */
  fr,
  /** Spanish locale */
  es,
  /** German locale */
  de,
  /** Italian locale */
  it,
  /** Russian locale */
  ru,
  /** Japanese locale */
  ja,
  /** Korean locale */
  ko,
  /** Chinese (Simplified) locale */
  zh,
  /** Arabic locale */
  ar,
  /** Dutch locale */
  nl,
  /** Swedish locale */
  sv,
  /** Danish locale */
  da,
  /** Finnish locale */
  fi,
  /** Polish locale */
  pl,
  /** Turkish locale */
  tr,
  /** Thai locale */
  th
} as const;