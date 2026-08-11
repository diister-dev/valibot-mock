/**
 * Locks path fidelity in GenerationContext / ResolveNode: array and tuple
 * items carry their index ("refs.0", "users.1.email") so per-path resolve
 * hooks can address individual items, and the semantic tier treats numeric
 * segments as transparent (items inherit the enclosing key's semantic).
 */
import { assert, assertEquals } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator, fake, SKIP } from "../mod.ts";

const refId = v.pipe(v.string(), v.regex(/^user:[a-zA-Z0-9]+$/));

Deno.test("path — array items are indexed and individually addressable", () => {
  const schema = v.object({
    refs: v.pipe(v.array(refId), v.minLength(3), v.maxLength(3)),
  });
  const doc = createMockGenerator(schema, {
    faker: { seed: 1 },
    resolve: (node) => {
      const match = node.path.match(/^refs\.(\d+)$/);
      return match ? `user:pool${match[1]}` : SKIP;
    },
  }).generate();
  assertEquals(doc.refs, ["user:pool0", "user:pool1", "user:pool2"]);
});

Deno.test("path — nested: array of objects yields users.<i>.<key>", () => {
  const schema = v.object({
    users: v.pipe(v.array(v.object({ ref: refId })), v.minLength(2), v.maxLength(2)),
  });
  const seen: string[] = [];
  createMockGenerator(schema, {
    faker: { seed: 1 },
    resolve: (node) => {
      seen.push(node.path);
      return SKIP;
    },
  }).generate();
  assert(seen.includes("users.0.ref"), `missing users.0.ref in ${JSON.stringify(seen)}`);
  assert(seen.includes("users.1.ref"), `missing users.1.ref in ${JSON.stringify(seen)}`);
});

Deno.test("path — tuple items are indexed", () => {
  const schema = v.object({ pair: v.tuple([v.string(), v.number()]) });
  const seen: string[] = [];
  createMockGenerator(schema, {
    faker: { seed: 1 },
    resolve: (node) => {
      seen.push(node.path);
      return SKIP;
    },
  }).generate();
  assert(seen.includes("pair.0"), `missing pair.0 in ${JSON.stringify(seen)}`);
  assert(seen.includes("pair.1"), `missing pair.1 in ${JSON.stringify(seen)}`);
});

Deno.test("path — fake() context sees the indexed path too", () => {
  const paths: string[] = [];
  const schema = v.object({
    items: v.pipe(
      v.array(v.pipe(v.string(), fake((_f, context) => {
        paths.push(context.path);
        return "x";
      }))),
      v.minLength(2),
      v.maxLength(2),
    ),
  });
  createMockGenerator(schema, { faker: { seed: 1 } }).generate();
  assertEquals(paths, ["items.0", "items.1"]);
});

Deno.test("path — semantic tier ignores numeric segments (array items inherit the key)", () => {
  const schema = v.object({
    email: v.pipe(v.array(v.string()), v.minLength(3), v.maxLength(3)),
  });
  const doc = createMockGenerator(schema, { faker: { seed: 1 } }).generate();
  for (const item of doc.email) {
    assert(item.includes("@"), `array item under semantic key not realistic: ${item}`);
  }
});
