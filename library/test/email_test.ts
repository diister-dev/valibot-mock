import { assertEquals } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator } from "../src/generator.ts";

const EMAIL_REGEX: RegExp = /^[a-zA-Z0-9\+\-_]+(?:\.[a-zA-Z0-9\+\-_]+)*@[a-zA-Z0-9]+(?:[.\-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;

const INDEX_SYMBOL = Symbol("mongodbee.index");

const EmailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.regex(EMAIL_REGEX),
  v.minLength(3),
  v.maxLength(254),
);

const EmailSchemaWithMetadata = v.pipe(
  EmailSchema,
  v.metadata({
    [INDEX_SYMBOL]: "level1"
  }),
);

const INDEX_SYMBOL_2 = Symbol("mongodbee.index2");
const INDEX_SYMBOL_3 = Symbol("mongodbee.index3");

// Test avec plusieurs niveaux de pipes imbriqués
const EmailSchemaMultipleMetadata = v.pipe(
  v.pipe(
    EmailSchema,
    v.metadata({
      [INDEX_SYMBOL]: "level1"
    }),
  ),
  v.metadata({
    [INDEX_SYMBOL_2]: "level2"
  }),
);

const EmailSchemaDeepNested = v.pipe(
  v.pipe(
    v.pipe(
      EmailSchema,
      v.metadata({
        [INDEX_SYMBOL]: "level1"
      }),
    ),
    v.metadata({
      [INDEX_SYMBOL_2]: "level2"
    }),
  ),
  v.metadata({
    [INDEX_SYMBOL_3]: "level3"
  }),
);

Deno.test("EmailSchema - generates valid email matching custom regex", () => {
  const generator = createMockGenerator(EmailSchema, {
    maxAttempts: 100 // Increase attempts for complex regex
  });
  
  console.log("\nGenerating 5 emails to test:");
  for (let i = 0; i < 5; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. ${result}`);
      
      // Validate it matches the regex
      assertEquals(EMAIL_REGEX.test(result), true, `Generated email "${result}" should match EMAIL_REGEX`);
      
      // Validate with Valibot
      const validation = v.safeParse(EmailSchema, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Generated email should pass Valibot validation`);
      
    } catch (error) {
      console.error(`Failed to generate email #${i + 1}:`, error);
      throw error;
    }
  }
});

Deno.test("EmailSchema - test what generator produces without regex", () => {
  const SimpleEmailSchema = v.pipe(
    v.string(),
    v.email()
  );
  
  const generator = createMockGenerator(SimpleEmailSchema);
  
  console.log("\nTesting simple v.email() generation:");
  for (let i = 0; i < 3; i++) {
    const result = generator.generate();
    console.log(`  ${i + 1}. ${result}`);
    console.log(`     Matches custom regex: ${EMAIL_REGEX.test(result)}`);
  }
});

Deno.test("EmailSchema - manually test regex generation", () => {
  const RegexOnlySchema = v.pipe(
    v.string(),
    v.regex(EMAIL_REGEX)
  );
  
  const generator = createMockGenerator(RegexOnlySchema, {
    maxAttempts: 100
  });
  
  console.log("\nTesting regex-only generation:");
  try {
    const result = generator.generate();
    console.log(`  Generated: ${result}`);
    console.log(`  Matches regex: ${EMAIL_REGEX.test(result)}`);
    console.log(`  Length: ${result.length}`);
  } catch (error) {
    console.error("Failed to generate:", error);
    throw error;
  }
});

Deno.test("EmailSchema with metadata - generates valid email", () => {
  const generator = createMockGenerator(EmailSchemaWithMetadata, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating emails with metadata:");
  for (let i = 0; i < 5; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. ${result}`);
      
      // Validate it matches the regex
      assertEquals(EMAIL_REGEX.test(result), true, `Generated email "${result}" should match EMAIL_REGEX`);
      
      // Validate with Valibot
      const validation = v.safeParse(EmailSchemaWithMetadata, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Generated email should pass Valibot validation`);
      
    } catch (error) {
      console.error(`Failed to generate email with metadata #${i + 1}:`, error);
      throw error;
    }
  }
});

Deno.test("EmailSchema with multiple nested pipes - level 2", () => {
  const generator = createMockGenerator(EmailSchemaMultipleMetadata, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating emails with 2 levels of nested metadata:");
  for (let i = 0; i < 3; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. ${result}`);
      
      assertEquals(EMAIL_REGEX.test(result), true, `Generated email should match EMAIL_REGEX`);
      
      const validation = v.safeParse(EmailSchemaMultipleMetadata, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Generated email should pass validation`);
      
    } catch (error) {
      console.error(`Failed at level 2 nested #${i + 1}:`, error);
      throw error;
    }
  }
});

Deno.test("EmailSchema with deeply nested pipes - level 3", () => {
  const generator = createMockGenerator(EmailSchemaDeepNested, {
    maxAttempts: 100
  });
  
  console.log("\nGenerating emails with 3 levels of nested metadata:");
  for (let i = 0; i < 3; i++) {
    try {
      const result = generator.generate();
      console.log(`  ${i + 1}. ${result}`);
      
      assertEquals(EMAIL_REGEX.test(result), true, `Generated email should match EMAIL_REGEX`);
      
      const validation = v.safeParse(EmailSchemaDeepNested, result);
      if (!validation.success) {
        console.error("Validation failed:", validation.issues);
      }
      assertEquals(validation.success, true, `Generated email should pass validation`);
      
    } catch (error) {
      console.error(`Failed at level 3 nested #${i + 1}:`, error);
      throw error;
    }
  }
});
