/**
 * Locks seed-determinism of the regex generation path. RandExp used its own
 * `Math.random()` internally, so EVERY regex-backed value (i.e. every mocked
 * identifier) differed between two generators built with the same seed. The
 * fix routes RandExp's `randInt` through the generator's faker instance.
 */
import { assertEquals, assertNotEquals } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator } from "../mod.ts";

// The exact schema that proved the bug (`user:l` vs `user:M` with seed 42).
const refIdSchema = v.pipe(v.string(), v.regex(/^user:[a-zA-Z0-9]+/));

Deno.test("regex determinism — same seed, same outputs (v.regex)", () => {
  const a = createMockGenerator(refIdSchema, { faker: { seed: 42 } }).generateMany(5);
  const b = createMockGenerator(refIdSchema, { faker: { seed: 42 } }).generateMany(5);
  assertEquals(a, b);
});

Deno.test("regex determinism — different seeds, different outputs (not hard-seeded)", () => {
  // 16 chars of [a-zA-Z0-9]: collision between independent streams is
  // practically impossible, so inequality proves the seed actually varies.
  const wide = v.pipe(v.string(), v.regex(/^user:[a-zA-Z0-9]{16}$/));
  const a = createMockGenerator(wide, { faker: { seed: 42 } }).generateMany(5);
  const b = createMockGenerator(wide, { faker: { seed: 43 } }).generateMany(5);
  assertNotEquals(a, b);
});

Deno.test("regex determinism — regex-backed actions (ulid) are seed-deterministic too", () => {
  const schema = v.object({ id: v.pipe(v.string(), v.ulid()) });
  const a = createMockGenerator(schema, { faker: { seed: 7 } }).generateMany(3);
  const b = createMockGenerator(schema, { faker: { seed: 7 } }).generateMany(3);
  assertEquals(a, b);
});

Deno.test("regex determinism — regex values still satisfy their schema", () => {
  const gen = createMockGenerator(refIdSchema, { faker: { seed: 1 } });
  for (const value of gen.generateMany(20)) {
    assertEquals(v.safeParse(refIdSchema, value).success, true, `invalid: ${value}`);
  }
});
