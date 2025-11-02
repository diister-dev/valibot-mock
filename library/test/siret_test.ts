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

const INDEX_SYMBOL = Symbol("company.index");
const INDEX_SYMBOL_2 = Symbol("company.unique");

// Test avec metadata simple
const SiretSchemaWithMetadata = v.pipe(
  SiretSchema,
  v.metadata({
    [INDEX_SYMBOL]: "siret_field"
  }),
);

// Test avec metadata sur l'union
const SiretOrSirenSchemaWithMetadata = v.pipe(
  SiretOrSirenSchema,
  v.metadata({
    [INDEX_SYMBOL]: "company_identifier"
  }),
);

// Test avec pipes imbriqués multiples
const SiretSchemaDeepNested = v.pipe(
  v.pipe(
    SiretSchema,
    v.metadata({
      [INDEX_SYMBOL]: "level1"
    }),
  ),
  v.metadata({
    [INDEX_SYMBOL_2]: "level2"
  }),
);

// Test dans un objet complexe
const CompanySchema = v.object({
  name: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
  siret: SiretSchema,
  email: v.pipe(v.string(), v.email()),
  active: v.boolean(),
});

// Test avec metadata dans un objet
const CompanySchemaWithMetadata = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: v.string(),
  siret: v.pipe(
    SiretSchema,
    v.metadata({
      [INDEX_SYMBOL]: "company_siret"
    }),
  ),
  siren: v.pipe(
    SirenSchema,
    v.metadata({
      [INDEX_SYMBOL]: "company_siren"
    }),
  ),
  identifier: SiretOrSirenSchema,
});

// Test avec union dans un objet
const RegistrationSchema = v.object({
  companyName: v.string(),
  taxId: v.pipe(
    SiretOrSirenSchemaWithMetadata,
    v.metadata({
      [INDEX_SYMBOL_2]: "tax_identifier"
    }),
  ),
  registrationDate: v.date(),
});

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

Deno.test("SiretSchema with metadata - generates valid SIRET", () => {
  const generator = createMockGenerator(SiretSchemaWithMetadata, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating SIRETs with metadata:");
  for (let i = 0; i < 5; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. ${result} (length: ${result.length})`);
      
      assertEquals(/^[0-9]+$/.test(result), true, `Should be only digits`);
      assertEquals(result.length, 14, `Should be exactly 14 characters`);
      
      const validation = v.safeParse(SiretSchemaWithMetadata, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Should pass validation`);
      
    } catch (error) {
      console.error(`Failed to generate SIRET with metadata #${i + 1}:`, error);
      throw error;
    }
  }
});

Deno.test("SiretOrSirenSchema with metadata - generates valid SIRET or SIREN", () => {
  const generator = createMockGenerator(SiretOrSirenSchemaWithMetadata, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating SIRET or SIREN (union) with metadata:");
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
      
      assertEquals(/^[0-9]+$/.test(result), true, `Should be only digits`);
      assertEquals(isSiret || isSiren, true, `Length should be 9 or 14`);
      
      const validation = v.safeParse(SiretOrSirenSchemaWithMetadata, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Should pass validation`);
      
    } catch (error) {
      console.error(`Failed to generate SIRET/SIREN with metadata #${i + 1}:`, error);
      throw error;
    }
  }
  
  console.log(`\n  Summary: ${siretCount} SIRETs, ${sirenCount} SIRENs`);
});

Deno.test("SiretSchema with deeply nested pipes - level 2", () => {
  const generator = createMockGenerator(SiretSchemaDeepNested, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating SIRETs with 2 levels of nested metadata:");
  for (let i = 0; i < 5; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. ${result} (length: ${result.length})`);
      
      assertEquals(/^[0-9]+$/.test(result), true, `Should be only digits`);
      assertEquals(result.length, 14, `Should be exactly 14 characters`);
      
      const validation = v.safeParse(SiretSchemaDeepNested, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Should pass validation`);
      
    } catch (error) {
      console.error(`Failed to generate deeply nested SIRET #${i + 1}:`, error);
      throw error;
    }
  }
});

Deno.test("CompanySchema - object with SIRET field", () => {
  const generator = createMockGenerator(CompanySchema, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating Company objects:");
  for (let i = 0; i < 3; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. Company:`, JSON.stringify(result, null, 4));
      
      // Validate SIRET field
      assertEquals(typeof result.siret, "string", "SIRET should be a string");
      assertEquals(/^[0-9]+$/.test(result.siret), true, "SIRET should be only digits");
      assertEquals(result.siret.length, 14, "SIRET should be 14 digits");
      
      // Validate other fields
      assertEquals(typeof result.name, "string");
      assertEquals(typeof result.email, "string");
      assertEquals(typeof result.active, "boolean");
      
      // Validate with Valibot
      const validation = v.safeParse(CompanySchema, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, "Should pass validation");
      
    } catch (error) {
      console.error(`Failed to generate Company #${i + 1}:`, error);
      throw error;
    }
  }
});

Deno.test("CompanySchemaWithMetadata - object with SIRET and SIREN with metadata", () => {
  const generator = createMockGenerator(CompanySchemaWithMetadata, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating Company objects with metadata:");
  for (let i = 0; i < 3; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. Company:`, JSON.stringify(result, null, 4));
      
      // Validate SIRET field
      assertEquals(typeof result.siret, "string");
      assertEquals(/^[0-9]+$/.test(result.siret), true, "SIRET should be only digits");
      assertEquals(result.siret.length, 14, "SIRET should be 14 digits");
      
      // Validate SIREN field
      assertEquals(typeof result.siren, "string");
      assertEquals(/^[0-9]+$/.test(result.siren), true, "SIREN should be only digits");
      assertEquals(result.siren.length, 9, "SIREN should be 9 digits");
      
      // Validate identifier (union)
      assertEquals(typeof result.identifier, "string");
      assertEquals(/^[0-9]+$/.test(result.identifier), true, "identifier should be only digits");
      const isValidLength = result.identifier.length === 14 || result.identifier.length === 9;
      assertEquals(isValidLength, true, "identifier should be 9 or 14 digits");
      
      // Validate with Valibot
      const validation = v.safeParse(CompanySchemaWithMetadata, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, "Should pass validation");
      
    } catch (error) {
      console.error(`Failed to generate Company with metadata #${i + 1}:`, error);
      throw error;
    }
  }
});

Deno.test("RegistrationSchema - object with union and nested metadata", () => {
  const generator = createMockGenerator(RegistrationSchema, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating Registration objects:");
  for (let i = 0; i < 3; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. Registration:`, JSON.stringify(result, (_key, value) => {
        // Handle Date serialization
        return value instanceof Date ? value.toISOString() : value;
      }, 4));
      
      // Validate taxId field (union with nested metadata)
      assertEquals(typeof result.taxId, "string");
      assertEquals(/^[0-9]+$/.test(result.taxId), true, "taxId should be only digits");
      const isValidLength = result.taxId.length === 14 || result.taxId.length === 9;
      assertEquals(isValidLength, true, "taxId should be 9 or 14 digits");
      
      // Validate other fields
      assertEquals(typeof result.companyName, "string");
      assertEquals(result.registrationDate instanceof Date, true, "Should be a Date object");
      
      // Validate with Valibot
      const validation = v.safeParse(RegistrationSchema, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, "Should pass validation");
      
    } catch (error) {
      console.error(`Failed to generate Registration #${i + 1}:`, error);
      throw error;
    }
  }
});
