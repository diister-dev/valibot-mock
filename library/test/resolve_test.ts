/**
 * Locks the caller-side `resolve` hook: consulted at every node at any depth,
 * highest-precedence channel (resolve > fake() > semantics), SKIP falls
 * through to normal generation, and — unlike generate(overrides) — a resolved
 * value goes through the same v.safeParse gate as generated ones (invalid
 * injection throws, never passes silently).
 */
import { assert, assertEquals, assertThrows } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator, fake, SKIP } from "../mod.ts";
import type { ResolveNode } from "../mod.ts";

const refId = v.pipe(v.string(), v.regex(/^user:[a-zA-Z0-9]+$/));

Deno.test("resolve — provides a value at a nested path, other fields still generated", () => {
  const schema = v.object({
    name: v.string(),
    owner: v.object({ ref: refId }),
  });
  const gen = createMockGenerator(schema, {
    faker: { seed: 1 },
    resolve: (node) => node.path === "owner.ref" ? "user:existing42" : SKIP,
  });
  const doc = gen.generate();
  assertEquals(doc.owner.ref, "user:existing42");
  assert(typeof doc.name === "string" && doc.name.length >= 0);
});

Deno.test("resolve — SKIP everywhere is byte-identical to no hook (same seed)", () => {
  const schema = v.object({
    id: refId,
    tags: v.array(v.string()),
    n: v.number(),
  });
  const without = createMockGenerator(schema, { faker: { seed: 42 } }).generateMany(3);
  const withSkip = createMockGenerator(schema, {
    faker: { seed: 42 },
    resolve: () => SKIP,
  }).generateMany(3);
  assertEquals(without, withSkip);
});

Deno.test("resolve — reaches regex-carrying nodes and exposes the RegExp in schema.pipe", () => {
  // The gap this hook closes: semantics never fire on a regex-carrying
  // schema, and fake() requires owning the schema. The caller can detect
  // the constraint itself and inject a correlated id.
  let seenRegex: RegExp | null = null;
  const gen = createMockGenerator(v.object({ ref: refId }), {
    faker: { seed: 1 },
    resolve: (node) => {
      const pipe = (node.schema as { pipe?: { requirement?: unknown }[] }).pipe;
      const regex = pipe?.find((p) => p.requirement instanceof RegExp)?.requirement as RegExp | undefined;
      if (regex) {
        seenRegex = regex;
        return "user:fromPool7";
      }
      return SKIP;
    },
  });
  assertEquals(gen.generate().ref, "user:fromPool7");
  assert(seenRegex !== null, "resolve never saw the RegExp in schema.pipe");
});

Deno.test("resolve — invalid value throws with the path, never passes silently", () => {
  const gen = createMockGenerator(v.object({ ref: refId }), {
    faker: { seed: 1 },
    resolve: (node) => node.path === "ref" ? "not-a-ref" : SKIP,
  });
  const error = assertThrows(() => gen.generate(), Error);
  assert(error.message.includes('"ref"'), `path missing from: ${error.message}`);
});

Deno.test("resolve — wins over fake() metadata", () => {
  const schema = v.object({
    name: v.pipe(v.string(), fake(() => "FROM_FAKE")),
  });
  const resolved = createMockGenerator(schema, {
    faker: { seed: 1 },
    resolve: (node) => node.path === "name" ? "FROM_RESOLVE" : SKIP,
  }).generate();
  assertEquals(resolved.name, "FROM_RESOLVE");
  // And SKIP hands the node back to fake().
  const skipped = createMockGenerator(schema, {
    faker: { seed: 1 },
    resolve: () => SKIP,
  }).generate();
  assertEquals(skipped.name, "FROM_FAKE");
});

Deno.test("resolve — wins over the semantic tier", () => {
  const doc = createMockGenerator(v.object({ email: v.string() }), {
    faker: { seed: 1 },
    resolve: (node) => node.path === "email" ? "pinned-not-an-email" : SKIP,
  }).generate();
  assertEquals(doc.email, "pinned-not-an-email");
});

Deno.test("resolve — root node is consulted with path \"\"", () => {
  const paths: string[] = [];
  createMockGenerator(v.object({ a: v.string() }), {
    faker: { seed: 1 },
    resolve: (node) => {
      paths.push(node.path);
      return SKIP;
    },
  }).generate();
  assert(paths.includes(""), `root not consulted, saw: ${JSON.stringify(paths)}`);
  assert(paths.includes("a"));
});

Deno.test("resolve — a resolved object covers its whole subtree (children not visited)", () => {
  const visited: string[] = [];
  const doc = createMockGenerator(v.object({ owner: v.object({ ref: refId }) }), {
    faker: { seed: 1 },
    resolve: (node) => {
      visited.push(node.path);
      return node.path === "owner" ? { ref: "user:whole" } : SKIP;
    },
  }).generate();
  assertEquals(doc.owner, { ref: "user:whole" });
  assert(!visited.includes("owner.ref"), "children of a resolved node must not be visited");
});

Deno.test("resolve — node.faker is the generator's seeded instance (reproducible hooks)", () => {
  const pool = ["user:a1", "user:b2", "user:c3", "user:d4"];
  const pick = (node: ResolveNode) =>
    node.path === "ref" ? pool[node.faker.number.int({ min: 0, max: pool.length - 1 })] : SKIP;
  const schema = v.object({ ref: refId, other: v.string() });
  const a = createMockGenerator(schema, { faker: { seed: 5 }, resolve: pick }).generateMany(4);
  const b = createMockGenerator(schema, { faker: { seed: 5 }, resolve: pick }).generateMany(4);
  assertEquals(a, b);
  for (const row of a) assert(pool.includes(row.ref));
});
