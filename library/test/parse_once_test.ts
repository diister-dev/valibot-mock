/**
 * A composed value is parsed by the node that drew it, not again by every
 * ancestor: re-parsing a document once per level of nesting was most of a
 * nested document's cost, and every re-parse of a lazy schema rebuilt it.
 * What a parse adds — defaults, transforms, union and variant choices,
 * record key filtering — must still land exactly as before.
 */
import { test } from "node:test";
import { assert, assertEquals } from "./+assert.ts";
import * as v from "valibot";
import { createMockGenerator } from "../mod.ts";

test("parse once — a leaf nested three levels deep is checked once per value", () => {
  let checks = 0;
  const leaf = v.pipe(
    v.number(),
    v.check(() => {
      checks++;
      return true;
    }),
  );
  const schema = v.object({
    a: v.object({ b: v.array(v.object({ c: leaf })) }),
  });
  const documents = createMockGenerator(schema, {
    faker: { seed: 3 },
  }).generateMany(5);
  const leaves = documents.reduce((n, doc) => n + doc.a.b.length, 0);
  assertEquals(checks, leaves);
});

test("parse once — a recursive lazy schema is not rebuilt by every ancestor's parse", () => {
  let builds = 0;
  type Node = { label: string; children?: Node[] | undefined };
  const NodeSchema: v.GenericSchema<Node> = v.lazy(() => {
    builds++;
    return v.object({
      label: v.string(),
      children: v.optional(v.array(v.lazy(() => NodeSchema))),
    });
  });
  const generator = createMockGenerator(v.object({ root: NodeSchema }), {
    faker: { seed: 11 },
    defaultArrayMaxLength: 2,
  });
  const count = (node: Node): number =>
    1 + (node.children ?? []).reduce((n, child) => n + count(child), 0);
  const documents = generator.generateMany(5);
  const nodes = documents.reduce((n, doc) => n + count(doc.root), 0);
  // One build per generated node, plus the stability judgement — never one
  // per ancestor's parse.
  assert(builds <= nodes + 2, `${builds} builds for ${nodes} nodes`);
});

test("parse once — what a parse adds still lands", () => {
  const schema = v.object({
    defaulted: v.nullable(v.number(), 7),
    trimmed: v.pipe(v.string(), v.trim(), v.toUpperCase()),
    transformed: v.pipe(
      v.string(),
      v.transform((s) => `${s}!`),
    ),
    stripped: v.union([
      v.object({ a: v.string() }),
      v.object({ a: v.string(), b: v.number() }),
    ]),
    nested: v.object({ flag: v.optional(v.boolean(), true) }),
  });
  for (const doc of createMockGenerator(schema, {
    faker: { seed: 5 },
  }).generateMany(30)) {
    assert(doc.defaulted !== null);
    assertEquals(doc.trimmed, doc.trimmed.trim().toUpperCase());
    assert(doc.transformed.endsWith("!"));
    assertEquals(Object.keys(doc.stripped), ["a"]);
    assertEquals(typeof doc.nested.flag, "boolean");
    assert(v.safeParse(v.object({ a: v.string() }), doc.stripped).success);
  }
});

test("lazy — an argument-less getter is resolved once, a getter reading its argument every time", () => {
  let builds = 0;
  type Node = { label: string; children?: Node[] | undefined };
  const NodeSchema: v.GenericSchema<Node> = v.lazy(() => {
    builds++;
    return v.object({
      label: v.string(),
      children: v.optional(v.array(v.lazy(() => NodeSchema))),
    });
  });
  createMockGenerator(v.object({ root: NodeSchema }), {
    faker: { seed: 11 },
    defaultArrayMaxLength: 2,
  }).generateMany(5);
  assertEquals(builds, 1);

  let reads = 0;
  const reading = v.lazy((input: unknown) => {
    reads++;
    return typeof input === "number" ? v.number() : v.string();
  });
  createMockGenerator(v.object({ value: reading }), {
    faker: { seed: 1 },
  }).generateMany(3);
  assert(reads >= 3, `${reads} calls`);
});
