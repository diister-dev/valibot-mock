import { test } from "node:test";
import { assert, assertEquals } from "./+assert.ts";
import * as v from "valibot";
import { createMockGenerator } from "../mod.ts";

test("generate(overrides) replaces top-level object fields", () => {
  const schema = v.object({
    id: v.string(),
    name: v.string(),
    age: v.number(),
  });
  const out = createMockGenerator(schema).generate({
    id: "fixed-id",
    name: "Alice",
  });
  assertEquals(out.id, "fixed-id");
  assertEquals(out.name, "Alice");
  assert(
    typeof out.age === "number",
    "non-overridden fields are still generated",
  );
});

test("generate() without overrides is unchanged", () => {
  const out = createMockGenerator(v.object({ a: v.string() })).generate();
  assert(typeof out.a === "string");
});

test("generateMany(count, fn) applies per-index overrides", () => {
  const schema = v.object({ ref: v.string(), n: v.number() });
  const rows = createMockGenerator(schema).generateMany(3, (i) => ({
    ref: `ref-${i}`,
  }));
  assertEquals(
    rows.map((r) => r.ref),
    ["ref-0", "ref-1", "ref-2"],
  );
});

test("generateMany(count, obj) applies the same overrides to every row", () => {
  const rows = createMockGenerator(v.object({ tag: v.string() })).generateMany(
    4,
    { tag: "same" },
  );
  assertEquals(
    rows.map((r) => r.tag),
    ["same", "same", "same", "same"],
  );
});
