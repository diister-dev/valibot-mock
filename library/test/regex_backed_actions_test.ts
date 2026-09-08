/**
 * Locks generation for valibot's regex-BACKED actions that are not
 * `v.regex()` itself: `hexColor`, `isoDate`, `ulid`, `slug`, … Each carries
 * a `requirement: RegExp` under its own action type name, so the string
 * handler must treat ANY validation action with a RegExp requirement as a
 * regex constraint. Before this, such schemas fell through to the random
 * fallback, failed validation 100 times, dumped the schema to console.error
 * and threw "Max attempts reached" — silently breaking mock population in
 * consumers (mongodbee migration simulation).
 */
import { test } from "node:test";
import { assert } from "./+assert.ts";
import * as v from "valibot";
import { createMockGenerator } from "../mod.ts";

function assertGeneratesValid(
  name: string,
  schema: v.GenericSchema,
  samples = 25,
) {
  for (let i = 0; i < samples; i++) {
    const generator = createMockGenerator(schema);
    const value = generator.generate();
    const parsed = v.safeParse(schema, value);
    assert(
      parsed.success,
      `${name}: generated value ${JSON.stringify(value)} does not satisfy the schema`,
    );
  }
}

test("hexColor generates valid values (regex-backed action, not v.regex)", () => {
  assertGeneratesValid("hexColor", v.pipe(v.string(), v.hexColor()));
});

test("isoDate generates valid values", () => {
  assertGeneratesValid("isoDate", v.pipe(v.string(), v.isoDate()));
});

test("ulid generates valid values", () => {
  assertGeneratesValid("ulid", v.pipe(v.string(), v.ulid()));
});

test("slug generates valid values", () => {
  assertGeneratesValid("slug", v.pipe(v.string(), v.slug()));
});

test("regex-backed action inside an object field generates without throwing", () => {
  const schema = v.object({
    name: v.string(),
    color: v.pipe(v.string(), v.hexColor()),
  });
  assertGeneratesValid("object with hexColor field", schema, 10);
});
