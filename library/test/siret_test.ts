import { assertEquals } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator } from "../src/generator.ts";

const SiretSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9]+$/),
  v.minLength(14),
  v.maxLength(14),
);

const SirenSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9]+$/),
  v.minLength(9),
  v.maxLength(9),
);

const SiretOrSirenSchema = v.union([SiretSchema, SirenSchema]);

Deno.test("SiretSchema - generates valid SIRET", () => {
  const generator = createMockGenerator(SiretSchema, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating SIRETs:");
  for (let i = 0; i < 5; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. ${result} (length: ${result.length})`);
      
      // Validate it matches the regex
      assertEquals(/^[0-9]+$/.test(result), true, `Generated SIRET "${result}" should be only digits`);
      
      // Validate length
      assertEquals(result.length, 14, `SIRET should be exactly 14 characters`);
      
      // Validate with Valibot
      const validation = v.safeParse(SiretSchema, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Generated SIRET should pass Valibot validation`);
      
    } catch (error) {
      console.error(`Failed to generate SIRET #${i + 1}:`, error);
      throw error;
    }
  }
});

Deno.test("SiretSchema - test what gets generated before validation", () => {
  const SimpleRegexSchema = v.pipe(
    v.string(),
    v.regex(/^[0-9]+$/)
  );
  
  const generator = createMockGenerator(SimpleRegexSchema, {
    maxAttempts: 100
  });
  
  console.log("\nTesting simple numeric regex generation:");
  for (let i = 0; i < 3; i++) {
    const result = generator.generate();
    console.log(`  ${i + 1}. ${result} (length: ${result.length}, matches: ${/^[0-9]+$/.test(result)})`);
  }
});

Deno.test("SirenSchema - generates valid SIREN (9 digits)", () => {
  const generator = createMockGenerator(SirenSchema, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating SIRENs:");
  for (let i = 0; i < 5; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. ${result} (length: ${result.length})`);
      
      // Validate it matches the regex
      assertEquals(/^[0-9]+$/.test(result), true, `Generated SIREN "${result}" should be only digits`);
      
      // Validate length
      assertEquals(result.length, 9, `SIREN should be exactly 9 characters`);
      
      // Validate with Valibot
      const validation = v.safeParse(SirenSchema, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Generated SIREN should pass Valibot validation`);
      
    } catch (error) {
      console.error(`Failed to generate SIREN #${i + 1}:`, error);
      throw error;
    }
  }
});

Deno.test("SiretOrSirenSchema - generates valid SIRET or SIREN", () => {
  const generator = createMockGenerator(SiretOrSirenSchema, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating SIRET or SIREN (union):");
  let siretCount = 0;
  let sirenCount = 0;
  
  for (let i = 0; i < 10; i++) {
    try {
      const result = generator.generate();
      const isSiret = result.length === 14;
      const isSiren = result.length === 9;
      
      if (isSiret) siretCount++;
      if (isSiren) sirenCount++;
      
      console.log(`  ${i + 1}. ${result} (length: ${result.length}, type: ${isSiret ? 'SIRET' : 'SIREN'})`);
      
      // Validate it matches the regex
      assertEquals(/^[0-9]+$/.test(result), true, `Generated value should be only digits`);
      
      // Validate length is either 9 or 14
      assertEquals(isSiret || isSiren, true, `Length should be 9 (SIREN) or 14 (SIRET)`);
      
      // Validate with Valibot
      const validation = v.safeParse(SiretOrSirenSchema, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Generated value should pass Valibot validation`);
      
    } catch (error) {
      console.error(`Failed to generate SIRET/SIREN #${i + 1}:`, error);
      throw error;
    }
  }
  
  console.log(`\n  Summary: ${siretCount} SIRETs (14 digits), ${sirenCount} SIRENs (9 digits)`);
  
  // Both types should appear at least once in 10 generations (statistically likely)
  // But we won't assert this as it's random
});
