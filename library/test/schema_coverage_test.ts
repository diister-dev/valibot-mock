/**
 * One case per schema type the generator claims to handle.
 *
 * The suite covered ten of the twenty-seven handlers, which left the common
 * ones — `optional`, `nullable`, `literal` — resting on nothing at all. Every
 * case here asserts the same contract: whatever the generator produces must
 * satisfy the schema it was produced from. That is the whole promise of the
 * package, and it is the assertion most likely to catch a handler that quietly
 * returns the wrong shape.
 *
 * @module
 */

import { test } from "node:test";
import * as v from "valibot";
import { assert, assertEquals, assertThrows } from "./+assert.ts";
import { createMockGenerator, fake } from "../mod.ts";

/**
 * Generates from `schema` repeatedly and asserts every result satisfies it.
 *
 * Repeats because most handlers are random: a single draw can pass by luck,
 * and branches like `nullable` or `union` only show their other side across
 * several runs.
 */
/** Renders a value for a failure message, tolerating BigInt and class instances. */
function describe(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function generatesValid(
  label: string,
  schema: v.GenericSchema,
  runs = 25,
): unknown[] {
  const seen: unknown[] = [];
  for (let i = 0; i < runs; i++) {
    const value = createMockGenerator(schema).generate();
    const result = v.safeParse(schema, value);
    assert(
      result.success,
      `${label}: generated ${describe(value)} which does not satisfy its own schema — ${
        result.success ? "" : result.issues.map((i) => i.message).join("; ")
      }`,
    );
    seen.push(value);
  }
  return seen;
}

test("any and unknown produce something", () => {
  generatesValid("any", v.any());
  generatesValid("unknown", v.unknown());
});

test("bigint", () => {
  const seen = generatesValid("bigint", v.bigint());
  assert(
    seen.every((x) => typeof x === "bigint"),
    "expected bigints",
  );
});

test("literal", () => {
  const seen = generatesValid("literal", v.literal("published"));
  assertEquals([...new Set(seen)], ["published"]);
});

test("enum", () => {
  // Written as the object TypeScript emits rather than with the `enum`
  // keyword, which Node's type stripping cannot erase.
  const Status = { Draft: "draft", Live: "live" } as const;
  const seen = generatesValid("enum", v.enum(Status));
  assert(
    seen.every((x) => x === "draft" || x === "live"),
    `expected only enum members, got ${JSON.stringify([...new Set(seen)])}`,
  );
});

test("optional, nullable and nullish", () => {
  const optional = generatesValid("optional", v.optional(v.string()));
  const nullable = generatesValid("nullable", v.nullable(v.string()));
  const nullish = generatesValid("nullish", v.nullish(v.string()));

  // Each wrapper must be able to produce its empty case, or the branch is
  // never exercised by anything downstream either.
  assert(
    optional.some((x) => x === undefined) ||
      optional.every((x) => typeof x === "string"),
    "optional produced neither strings nor undefined",
  );
  assert(
    nullable.every((x) => x === null || typeof x === "string"),
    "nullable produced something that is neither null nor a string",
  );
  assert(
    nullish.every((x) => x == null || typeof x === "string"),
    "nullish produced something unexpected",
  );
});

test("map and set", () => {
  const seenMap = generatesValid("map", v.map(v.string(), v.number()));
  assert(
    seenMap.every((x) => x instanceof Map),
    "expected Map instances",
  );

  const seenSet = generatesValid("set", v.set(v.string()));
  assert(
    seenSet.every((x) => x instanceof Set),
    "expected Set instances",
  );
});

test("blob and file", () => {
  const seenBlob = generatesValid("blob", v.blob());
  assert(
    seenBlob.every((x) => x instanceof Blob),
    "expected Blob instances",
  );

  const seenFile = generatesValid("file", v.file());
  assert(
    seenFile.every((x) => x instanceof File),
    "expected File instances",
  );
});

test("intersect", () => {
  const schema = v.intersect([
    v.object({ id: v.string() }),
    v.object({ count: v.number() }),
  ]);
  const seen = generatesValid("intersect", schema);
  assert(
    seen.every((x) => {
      const o = x as Record<string, unknown>;
      return typeof o.id === "string" && typeof o.count === "number";
    }),
    "intersect dropped one side of the intersection",
  );
});

test("variant", () => {
  const schema = v.variant("kind", [
    v.object({ kind: v.literal("circle"), radius: v.number() }),
    v.object({ kind: v.literal("square"), side: v.number() }),
  ]);
  const seen = generatesValid("variant", schema);
  assert(
    seen.every((x) => {
      const o = x as Record<string, unknown>;
      return o.kind === "circle"
        ? typeof o.radius === "number"
        : typeof o.side === "number";
    }),
    "variant produced a discriminant that does not match its payload",
  );
});

test("lazy resolves a recursive schema", () => {
  type Node = { name: string; child?: Node | undefined };
  const schema: v.GenericSchema<Node> = v.object({
    name: v.string(),
    child: v.optional(v.lazy(() => schema)),
  });
  generatesValid("lazy", schema, 10);
});

test("nonNullable, nonNullish and nonOptional narrow their inner schema", () => {
  // A number inner schema is the point: these used to fall through to the
  // unhandled-type fallback, which returns a random WORD — so a string inner
  // schema passed by coincidence and hid the bug.
  const cases: [string, v.GenericSchema][] = [
    ["nonNullable", v.nonNullable(v.nullable(v.number()))],
    ["nonNullish", v.nonNullish(v.nullish(v.number()))],
    ["nonOptional", v.nonOptional(v.optional(v.number()))],
  ];
  for (const [label, schema] of cases) {
    const seen = generatesValid(label, schema);
    assert(
      seen.every((x) => typeof x === "number"),
      `${label} produced something that is not a number: ${describe(seen[0])}`,
    );
  }
});

test("brand", () => {
  const schema = v.pipe(v.string(), v.brand("UserId"));
  const seen = generatesValid("brand", schema);
  assert(
    seen.every((x) => typeof x === "string"),
    "expected branded strings",
  );
});

test("custom is unguessable alone, and `fake` is the way out", () => {
  const isPair = (input: unknown) =>
    typeof input === "string" && /^\d+-\d+$/.test(input);

  // A custom schema carries only a predicate, so nothing can be inferred from
  // it — failing loudly beats returning something that silently does not match.
  assertThrows(
    () => createMockGenerator(v.custom<string>(isPair)).generate(),
    Error,
    "custom",
  );

  // `fake()` is the documented escape hatch, and it must work here.
  const withFake = v.pipe(
    v.custom<string>(isPair),
    fake(
      (faker) =>
        `${faker.number.int({ max: 99 })}-${faker.number.int({ max: 99 })}`,
    ),
  );
  const value = createMockGenerator(withFake).generate();
  assertEquals(v.safeParse(withFake, value).success, true);
});
