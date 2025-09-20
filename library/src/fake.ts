import * as v from "valibot";
import type { FakeGeneratorFn } from "./types.ts";

/**
 * Creates a custom fake generator for a schema.
 * This function uses Valibot's metadata system to attach custom generation logic.
 * 
 * @example Basic usage
 * ```ts
 * import * as v from "valibot";
 * import { fake } from "@diister/valibot-mock";
 * 
 * const schema = v.pipe(
 *   v.string(),
 *   v.maxLength(50),
 *   fake((faker) => faker.person.firstName())
 * );
 * ```
 * 
 * @example With context
 * ```ts
 * const schema = v.pipe(
 *   v.string(),
 *   fake((faker, context) => {
 *     console.log('Current path:', context.path);
 *     return faker.internet.email();
 *   })
 * );
 * ```
 * 
 * @param generator - Function that receives faker instance and context, returns the generated value
 * @returns A metadata transformation that can be used in a Valibot pipe
 */
export function fake<TInput>(generator: FakeGeneratorFn<unknown>): v.MetadataAction<TInput, Record<string | symbol, unknown>> {
  return v.metadata({
    [Symbol.for("fake_generator")]: generator
  });
}

/**
 * Utility function to extract fake generator from schema metadata
 */
export function getFakeGenerator<T>(schema: v.GenericSchema): FakeGeneratorFn<T> | null {
  try {
    const metadata = v.getMetadata(schema) as Record<string | symbol, unknown>;
    const key = Symbol.for("fake_generator");
    const generator = metadata[key as keyof typeof metadata];
    return typeof generator === 'function' ? generator as FakeGeneratorFn<T> : null;
  } catch (_error) {
    return null;
  }
}