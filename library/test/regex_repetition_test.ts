import { test } from "node:test";
import * as v from "valibot";
import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "./+assert.ts";
import { createMockGenerator } from "../src/generator.ts";
import { MockGenerationError } from "../src/errors.ts";
import { regexToStringMinMax } from "../src/regex-parser.ts";

/**
 * Patterns built from a repeated group: folder paths, slugs, dotted names.
 *
 * `/^\/(?:[^/]+\/)*$/` with `maxLength(1024)` used to fail every draw: the
 * transformer lowered `+` to `{0,1024}` (empty segments, rejected by the
 * pattern) and capped the outer `*` at 1024 as well, so the nested
 * quantifiers drew half-megabyte strings that the length check rejected. The
 * whole-value loop then retried 100 times, about 15 s per field.
 */

const PATH = /^\/(?:[^/]+\/)*$/;

const FAMILY: Array<{ name: string; regex: RegExp; maxLength?: number }> = [
  { name: "folder path, bounded", regex: PATH, maxLength: 1024 },
  { name: "folder path, default cap", regex: PATH },
  { name: "folder path, tight", regex: PATH, maxLength: 8 },
  { name: "slug", regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, maxLength: 64 },
  { name: "dotted name", regex: /^[a-z]+(?:\.[a-z]+)+$/, maxLength: 40 },
  { name: "repeated pairs", regex: /^(?:[A-Z]{2}\d{2})+$/, maxLength: 24 },
  { name: "unix path segments", regex: /^(?:\/[\w.-]+)+\/?$/, maxLength: 200 },
  { name: "csv of digits", regex: /^\d+(?:,\d+)*$/ },
];

for (const { name, regex, maxLength } of FAMILY) {
  test(`repeated-group regex yields valid values: ${name}`, () => {
    const schema = v.object({
      field: maxLength
        ? v.pipe(v.string(), v.maxLength(maxLength), v.regex(regex))
        : v.pipe(v.string(), v.regex(regex)),
    });
    const generator = createMockGenerator(schema, { faker: { seed: 7 } });
    const started = Date.now();
    for (let i = 0; i < 200; i++) {
      const value = generator.generate();
      assert(
        v.safeParse(schema, value).success,
        `invalid draw for ${regex}: ${JSON.stringify(value).slice(0, 80)}`,
      );
    }
    // 200 documents; a single failing field used to cost seconds.
    assert(Date.now() - started < 2000, `too slow: ${Date.now() - started}ms`);
  });
}

test("folder paths draw more than the root", () => {
  const schema = v.pipe(v.string(), v.maxLength(1024), v.regex(PATH));
  const generator = createMockGenerator(schema, { faker: { seed: 1 } });
  const values = new Set(
    Array.from({ length: 50 }, () => generator.generate()),
  );
  assert(values.has("/") || values.size > 1);
  assert(
    [...values].some((value) => value.split("/").length > 3),
    "expected nested folders among the draws",
  );
});

test("the budget keeps nested quantifiers within maxLength", () => {
  const result = regexToStringMinMax(PATH, 0, 1024, {});
  assert(result.isExact, "the fitted pattern should fit the bounds");
  assert(result.actualMaxLength !== null && result.actualMaxLength <= 1024);
  // The structural minimum of `+` survives the transform.
  assertEquals(new RegExp(result.transformed).test("//"), false);
});

test("an unreachable pattern fails fast, naming the field and the pattern", () => {
  // A lookahead RandExp cannot honour: no draw can ever match.
  const schema = v.object({
    code: v.pipe(v.string(), v.regex(/^(?=a)b$/)),
  });
  const generator = createMockGenerator(schema);
  const started = Date.now();
  const error = assertThrows(() => generator.generate(), MockGenerationError);
  assert(Date.now() - started < 500, `too slow: ${Date.now() - started}ms`);
  assertStringIncludes(error.message, '"code"');
  assertStringIncludes(error.message, "/^(?=a)b$/");
  assertEquals((error as MockGenerationError).path, "code");
  assertEquals((error as MockGenerationError).pattern, "/^(?=a)b$/");
});

test("a pattern longer than maxLength fails at once, without drawing", () => {
  const schema = v.object({
    id: v.pipe(v.string(), v.maxLength(10), v.regex(/^[0-9A-Z]{26}$/)),
  });
  const generator = createMockGenerator(schema);
  const error = assertThrows(() => generator.generate(), MockGenerationError);
  assertStringIncludes(error.message, '"id"');
  assertStringIncludes(error.message, "26");
});

test("maxRegexAttempts bounds the draws", () => {
  const schema = v.pipe(v.string(), v.regex(/^(?=a)b$/));
  const error = assertThrows(
    () => createMockGenerator(schema, { maxRegexAttempts: 3 }).generate(),
    MockGenerationError,
  );
  assertStringIncludes(error.message, "in 3 attempts");
});

test("a failing value is never printed", () => {
  const original = { error: console.error, warn: console.warn };
  const printed: unknown[] = [];
  console.error = (...args: unknown[]) => printed.push(args);
  console.warn = (...args: unknown[]) => printed.push(args);
  try {
    const schema = v.pipe(
      v.string(),
      v.regex(/^[a-z]+$/),
      v.check(() => false, "never"),
    );
    assertThrows(() => createMockGenerator(schema).generate());
  } finally {
    console.error = original.error;
    console.warn = original.warn;
  }
  assertEquals(printed.length, 0);
});

test("a structural ULID still fits without an explicit maxLength", () => {
  const schema = v.pipe(v.string(), v.ulid());
  const generator = createMockGenerator(schema, { faker: { seed: 3 } });
  for (let i = 0; i < 20; i++) {
    assert(v.safeParse(schema, generator.generate()).success);
  }
});
