import { assert, assertEquals } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator } from "../src/generator.ts";

/**
 * Tests for the `record` schema handler honoring `schema.key`.
 *
 * Regression: the handler used to always emit `faker.string.alphanumeric(8)`
 * for keys, ignoring the key schema. For `v.record(v.picklist([...]), ...)`
 * the generator would burn every retry attempt and finally throw
 * "Failed to generate valid value for schema type: record".
 */

Deno.test("record with picklist key emits only picklist values as keys", () => {
  const schema = v.record(
    v.picklist(["fr", "en"]),
    v.object({ subject: v.string() }),
  );
  const generator = createMockGenerator(schema);

  for (let i = 0; i < 30; i++) {
    const result = generator.generate();
    for (const key of Object.keys(result)) {
      assert(
        key === "fr" || key === "en",
        `Key "${key}" is not in picklist ["fr", "en"]`,
      );
    }
    const validation = v.safeParse(schema, result);
    assertEquals(validation.success, true, `Generated record must validate`);
  }
});

Deno.test("record with regex'd string key emits keys matching the pattern", () => {
  const KEY_REGEX = /^key_[a-z]{3}$/;
  const schema = v.record(
    v.pipe(v.string(), v.regex(KEY_REGEX)),
    v.number(),
  );
  const generator = createMockGenerator(schema);

  for (let i = 0; i < 20; i++) {
    const result = generator.generate();
    for (const key of Object.keys(result)) {
      assert(KEY_REGEX.test(key), `Key "${key}" does not match ${KEY_REGEX}`);
    }
    const validation = v.safeParse(schema, result);
    assertEquals(validation.success, true);
  }
});

Deno.test("record with plain string key still produces a valid record", () => {
  const schema = v.record(v.string(), v.number());
  const generator = createMockGenerator(schema);

  for (let i = 0; i < 20; i++) {
    const result = generator.generate();
    assertEquals(typeof result, "object");
    for (const value of Object.values(result)) {
      assertEquals(typeof value, "number");
    }
    const validation = v.safeParse(schema, result);
    assertEquals(validation.success, true);
  }
});
