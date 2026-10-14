/**
 * Locks seed-determinism of the regex generation path: every regex-backed
 * value (every mocked identifier) must reproduce identically for the same
 * seed. RandExp draws from `Math.random()` internally, which can silently
 * break that guarantee.
 */
import { test } from "node:test";
import { assertEquals, assertNotEquals } from "./+assert.ts";
import * as v from "valibot";
import { createMockGenerator } from "../mod.ts";

const refIdSchema = v.pipe(v.string(), v.regex(/^user:[a-zA-Z0-9]+/));

test("regex determinism — same seed, same outputs (v.regex)", () => {
  const a = createMockGenerator(refIdSchema, {
    faker: { seed: 42 },
  }).generateMany(5);
  const b = createMockGenerator(refIdSchema, {
    faker: { seed: 42 },
  }).generateMany(5);
  assertEquals(a, b);
});

test("regex determinism — different seeds, different outputs (not hard-seeded)", () => {
  // 16 chars of [a-zA-Z0-9]: collision between independent streams is
  // practically impossible, so inequality proves the seed actually varies.
  const wide = v.pipe(v.string(), v.regex(/^user:[a-zA-Z0-9]{16}$/));
  const a = createMockGenerator(wide, { faker: { seed: 42 } }).generateMany(5);
  const b = createMockGenerator(wide, { faker: { seed: 43 } }).generateMany(5);
  assertNotEquals(a, b);
});

test("regex determinism — regex-backed actions (ulid) are seed-deterministic too", () => {
  const schema = v.object({ id: v.pipe(v.string(), v.ulid()) });
  const a = createMockGenerator(schema, { faker: { seed: 7 } }).generateMany(3);
  const b = createMockGenerator(schema, { faker: { seed: 7 } }).generateMany(3);
  assertEquals(a, b);
});

test("regex determinism — regex values still satisfy their schema", () => {
  const gen = createMockGenerator(refIdSchema, { faker: { seed: 1 } });
  for (const value of gen.generateMany(20)) {
    assertEquals(
      v.safeParse(refIdSchema, value).success,
      true,
      `invalid: ${value}`,
    );
  }
});

test("regex determinism — interleaved generators each keep their own seeded stream", () => {
  const schema = v.object({
    id: v.pipe(v.string(), v.regex(/^user:[a-zA-Z0-9]{12}$/)),
    slug: v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  });
  const alone = (seed: number) =>
    createMockGenerator(schema, { faker: { seed } }).generateMany(4);
  const expected = [alone(1), alone(2)];

  const first = createMockGenerator(schema, { faker: { seed: 1 } });
  const second = createMockGenerator(schema, { faker: { seed: 2 } });
  const interleaved: unknown[][] = [[], []];
  for (let i = 0; i < 4; i++) {
    interleaved[0]!.push(first.generate());
    interleaved[1]!.push(second.generate());
  }
  assertEquals(interleaved, expected);
});
