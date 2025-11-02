import { assertEquals } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator } from "../src/generator.ts";

/**
 * Tests for regex patterns with exact length constraints.
 * Validates that randexp correctly enforces minLength/maxLength for patterns like /^[0-9]+$/
 * 
 * Real-world use cases:
 * - French SIRET (14 digits) and SIREN (9 digits) identifiers
 * - Phone numbers, zip codes, tax IDs
 * - Any fixed-length numeric or alphanumeric patterns
 */

// Test helper to create fixed-length digit schemas
const createDigitSchema = (length: number) => v.pipe(
  v.string(),
  v.regex(/^[0-9]+$/),
  v.minLength(length),
  v.maxLength(length)
);

Deno.test("Regex with exact length: 9 digits (SIREN)", () => {
  const schema = createDigitSchema(9);
  const generator = createMockGenerator(schema);
  
  for (let i = 0; i < 50; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertEquals(result.length, 9, `Should be exactly 9 digits, got ${result.length}: ${result}`);
    assertEquals(/^[0-9]+$/.test(result), true, "Should contain only digits");
    
    const validation = v.safeParse(schema, result);
    assertEquals(validation.success, true);
  }
});

Deno.test("Regex with exact length: 14 digits (SIRET)", () => {
  const schema = createDigitSchema(14);
  const generator = createMockGenerator(schema);
  
  for (let i = 0; i < 50; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertEquals(result.length, 14, `Should be exactly 14 digits, got ${result.length}: ${result}`);
    assertEquals(/^[0-9]+$/.test(result), true, "Should contain only digits");
    
    const validation = v.safeParse(schema, result);
    assertEquals(validation.success, true);
  }
});

Deno.test("Regex with length range: 2-4 digits", () => {
  const schema = v.pipe(
    v.string(),
    v.regex(/^[0-9]+$/),
    v.minLength(2),
    v.maxLength(4)
  );
  
  const generator = createMockGenerator(schema);
  
  for (let i = 0; i < 50; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertEquals(result.length >= 2 && result.length <= 4, true, 
      `Length should be between 2 and 4, got ${result.length}: ${result}`);
    assertEquals(/^[0-9]+$/.test(result), true, "Should contain only digits");
    
    const validation = v.safeParse(schema, result);
    assertEquals(validation.success, true);
  }
});

Deno.test("Union of different lengths: 9 or 14 digits", () => {
  const schema9 = createDigitSchema(9);
  const schema14 = createDigitSchema(14);
  const unionSchema = v.union([schema14, schema9]);
  
  const generator = createMockGenerator(unionSchema);
  const lengths = new Set<number>();
  
  for (let i = 0; i < 100; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertEquals([9, 14].includes(result.length), true, 
      `Should be 9 or 14 digits, got ${result.length}: ${result}`);
    assertEquals(/^[0-9]+$/.test(result), true, "Should contain only digits");
    
    lengths.add(result.length);
    
    const validation = v.safeParse(unionSchema, result);
    assertEquals(validation.success, true);
  }
  
  // Both lengths should appear in 100 iterations
  assertEquals(lengths.has(9), true, "Should generate 9-digit values");
  assertEquals(lengths.has(14), true, "Should generate 14-digit values");
});

Deno.test("With metadata wrapper: exact length preserved", () => {
  const METADATA_SYMBOL = Symbol("test.metadata");
  
  const schema = v.pipe(
    createDigitSchema(14),
    v.metadata({ [METADATA_SYMBOL]: { unique: true } })
  );
  
  const generator = createMockGenerator(schema);
  
  for (let i = 0; i < 50; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertEquals(result.length, 14, `Should be exactly 14 digits even with metadata`);
    assertEquals(/^[0-9]+$/.test(result), true);
  }
});

Deno.test("Nested pipes: multiple metadata layers", () => {
  const SYMBOL_1 = Symbol("layer1");
  const SYMBOL_2 = Symbol("layer2");
  
  const base = createDigitSchema(9);
  const level1 = v.pipe(base, v.metadata({ [SYMBOL_1]: "data1" }));
  const level2 = v.pipe(level1, v.metadata({ [SYMBOL_2]: "data2" }));
  
  const generator = createMockGenerator(level2);
  
  for (let i = 0; i < 50; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result, "string");
    assertEquals(result.length, 9, `Should preserve 9 digits through nested pipes`);
    assertEquals(/^[0-9]+$/.test(result), true);
  }
});

Deno.test("In object schema: multiple fixed-length fields", () => {
  const schema = v.object({
    siren: createDigitSchema(9),
    siret: createDigitSchema(14),
    zipCode: createDigitSchema(5),
  });
  
  const generator = createMockGenerator(schema);
  
  for (let i = 0; i < 20; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result.siren, "string");
    assertEquals(result.siren.length, 9, "SIREN should be 9 digits");
    
    assertEquals(typeof result.siret, "string");
    assertEquals(result.siret.length, 14, "SIRET should be 14 digits");
    
    assertEquals(typeof result.zipCode, "string");
    assertEquals(result.zipCode.length, 5, "Zip code should be 5 digits");
    
    const validation = v.safeParse(schema, result);
    assertEquals(validation.success, true);
  }
});

Deno.test("Union in object with metadata", () => {
  const SYMBOL = Symbol("index");
  
  const schema = v.object({
    name: v.string(),
    taxId: v.pipe(
      v.union([createDigitSchema(9), createDigitSchema(14)]),
      v.metadata({ [SYMBOL]: { unique: true } })
    ),
  });
  
  const generator = createMockGenerator(schema);
  
  for (let i = 0; i < 50; i++) {
    const result = generator.generate();
    
    assertEquals(typeof result.name, "string");
    assertEquals(typeof result.taxId, "string");
    assertEquals([9, 14].includes(result.taxId.length), true, 
      `TaxId should be 9 or 14 digits, got ${result.taxId.length}`);
    
    const validation = v.safeParse(schema, result);
    assertEquals(validation.success, true);
  }
});
