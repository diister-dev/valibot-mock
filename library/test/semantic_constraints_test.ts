import { test } from "node:test";
import { assert, assertEquals } from "./+assert.ts";
import * as v from "valibot";
import { createMockGenerator, locales } from "../mod.ts";

// A semantic value must NEVER be truncated into invalidity: the default
// string cap bounds random noise only. Regression: plain strings keyed
// `email` were sliced to 20 chars ("Golda.Bashirian@yaho") — invalid under
// v.email(), breaking mongodbee's migration simulation.
test("semantic email on a plain string is always a VALID email", () => {
  const schema = v.object({ email: v.string() });
  const emailCheck = v.pipe(v.string(), v.email());
  for (let seed = 0; seed < 60; seed++) {
    const doc = createMockGenerator(schema, {
      faker: { locale: [locales.en], seed },
    }).generate() as { email: string };
    assert(
      v.safeParse(emailCheck, doc.email).success,
      `seed ${seed}: ${JSON.stringify(doc.email)} must be a valid email`,
    );
  }
});

test("EXPLICIT max_length still constrains: fit or clean fallback, never truncated", () => {
  const schema = v.object({ email: v.pipe(v.string(), v.maxLength(10)) });
  for (let seed = 0; seed < 30; seed++) {
    const doc = createMockGenerator(schema, {
      faker: { locale: [locales.en], seed },
    }).generate() as { email: string };
    assert(doc.email.length <= 10, `seed ${seed}: respects explicit bound`);
    // Never a truncated email shape ("Foo.Bar@ho"): either a real fit or the
    // random fallback (alphanumeric, no "@").
    assert(
      !doc.email.includes("@") ||
        v.safeParse(v.pipe(v.string(), v.email()), doc.email).success,
      `seed ${seed}: ${JSON.stringify(doc.email)} must not be a mutilated email`,
    );
  }
});

test("partial faker options ({seed} without locale) get the locale default", () => {
  const schema = v.object({ name: v.string() });
  const a = createMockGenerator(schema, { faker: { seed: 7 } }).generate();
  const b = createMockGenerator(schema, { faker: { seed: 7 } }).generate();
  assertEquals(a, b); // deterministic, and no constructor crash
});
