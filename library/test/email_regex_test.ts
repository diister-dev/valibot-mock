import { assertEquals, assertMatch } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator } from "../src/generator.ts";

/**
 * Tests for complex email regex patterns with metadata.
 * Validates nested pipe handling and metadata preservation.
 */

// Complex email regex from real production code
const EMAIL_REGEX = /^[a-zA-Z0-9\+\-_]+(\.[a-zA-Z0-9\+\-_]+)*@[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/;

const EmailSchema = v.pipe(
  v.string(),
  v.regex(EMAIL_REGEX),
  v.minLength(5),
  v.maxLength(254),
);

Deno.test("Email: complex regex pattern", () => {
  const generator = createMockGenerator(EmailSchema);
  
  for (let i = 0; i < 20; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertMatch(result, EMAIL_REGEX, `Should match complex email pattern`);
    
    const validation = v.safeParse(EmailSchema, result);
    assertEquals(validation.success, true);
  }
});

Deno.test("Email: with metadata wrapper", () => {
  const SYMBOL = Symbol("email.index");
  
  const schema = v.pipe(
    EmailSchema,
    v.metadata({ [SYMBOL]: { unique: true } })
  );
  
  const generator = createMockGenerator(schema);
  
  for (let i = 0; i < 20; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertMatch(result, EMAIL_REGEX, `Should match email pattern with metadata`);
  }
});

Deno.test("Email: nested metadata (3 levels)", () => {
  const SYMBOL_1 = Symbol("level1");
  const SYMBOL_2 = Symbol("level2");
  const SYMBOL_3 = Symbol("level3");
  
  const level1 = v.pipe(EmailSchema, v.metadata({ [SYMBOL_1]: "data1" }));
  const level2 = v.pipe(level1, v.metadata({ [SYMBOL_2]: "data2" }));
  const level3 = v.pipe(level2, v.metadata({ [SYMBOL_3]: "data3" }));
  
  const generator = createMockGenerator(level3);
  
  for (let i = 0; i < 10; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertMatch(result, EMAIL_REGEX, `Should match pattern through 3 metadata layers`);
  }
});

Deno.test("Email: valibot built-in email validation", () => {
  const simpleEmailSchema = v.pipe(v.string(), v.email());
  const generator = createMockGenerator(simpleEmailSchema);
  
  for (let i = 0; i < 20; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertEquals(result.includes("@"), true, "Should contain @");
    
    const validation = v.safeParse(simpleEmailSchema, result);
    assertEquals(validation.success, true);
  }
});
