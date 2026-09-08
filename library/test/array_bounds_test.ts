/**
 * A declared `maxLength` describes the DOMAIN, not the size a mock needs.
 * Honouring it verbatim made a schema bounding an array at 150k generate 150k
 * items — and nested arrays multiply, so a two-level schema produced millions
 * of values and took its consumer out of memory. The string handler already
 * capped by the option; arrays did not.
 */
import { test } from "node:test";
import { assert, assertEquals } from "./+assert.ts";
import * as v from "valibot";
import { createMockGenerator } from "../mod.ts";

test("array: a huge declared maxLength is capped by defaultArrayMaxLength", () => {
  const schema = v.object({
    runs: v.pipe(v.array(v.number()), v.maxLength(150_000)),
  });

  for (let i = 0; i < 20; i++) {
    const doc = createMockGenerator(schema).generate();
    assert(
      doc.runs.length <= 10,
      `expected the default cap (10), got ${doc.runs.length}`,
    );
  }
});

test("array: nested huge bounds stay bounded at every level", () => {
  const schema = v.object({
    grids: v.pipe(
      v.array(v.pipe(v.array(v.number()), v.maxLength(150_000))),
      v.maxLength(50),
    ),
  });

  const doc = createMockGenerator(schema).generate();
  assert(doc.grids.length <= 10, `outer: ${doc.grids.length}`);
  for (const run of doc.grids) {
    assert(run.length <= 10, `inner: ${run.length}`);
  }
});

test("array: an explicit defaultArrayMaxLength raises the cap", () => {
  const schema = v.object({
    runs: v.pipe(v.array(v.number()), v.maxLength(150_000)),
  });

  let seen = 0;
  for (let i = 0; i < 40; i++) {
    const doc = createMockGenerator(schema, {
      defaultArrayMaxLength: 25,
    }).generate();
    assert(doc.runs.length <= 25, `expected ≤ 25, got ${doc.runs.length}`);
    seen = Math.max(seen, doc.runs.length);
  }
  assert(seen > 10, `the raised cap must be reachable, max seen: ${seen}`);
});

test("array: minLength wins over the cap so the value stays schema-valid", () => {
  const schema = v.object({
    runs: v.pipe(v.array(v.number()), v.minLength(30), v.maxLength(150_000)),
  });

  const doc = createMockGenerator(schema).generate();
  assert(doc.runs.length >= 30, `minLength violated: ${doc.runs.length}`);
  assertEquals(v.safeParse(schema, doc).success, true);
});

test("array: a small declared maxLength is still honoured", () => {
  const schema = v.object({
    runs: v.pipe(v.array(v.number()), v.maxLength(3)),
  });

  for (let i = 0; i < 20; i++) {
    const doc = createMockGenerator(schema).generate();
    assert(doc.runs.length <= 3, `declared bound ignored: ${doc.runs.length}`);
  }
});
