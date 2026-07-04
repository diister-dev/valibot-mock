import { assertEquals } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator, locales } from "../mod.ts";

// loose/strict objects generate like object (same .entries shape) — the
// migration simulator freezes envelope schemas with looseObject.
Deno.test("looseObject and strictObject generate their declared entries", () => {
  const loose = v.looseObject({ type: v.string(), n: v.number() });
  const strict = v.strictObject({ mode: v.picklist(["a", "b"]) });
  for (let seed = 0; seed < 5; seed++) {
    const l = createMockGenerator(loose, { faker: { locale: [locales.en], seed } }).generate() as Record<string, unknown>;
    assertEquals(typeof l.type, "string");
    assertEquals(typeof l.n, "number");
    const s = createMockGenerator(strict, { faker: { locale: [locales.en], seed } }).generate() as Record<string, unknown>;
    assertEquals(Object.keys(s), ["mode"]);
    assertEquals(v.safeParse(strict, s).success, true);
    assertEquals(v.safeParse(loose, l).success, true);
  }
});
