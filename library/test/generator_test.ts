import { assertEquals, assertExists } from "@std/assert";
import * as v from "valibot";
import { createMockGenerator } from "../src/generator.ts";

Deno.test("createMockGenerator - basic string generation", () => {
  const schema = v.string();
  const generator = createMockGenerator(schema);
  
  assertExists(generator);
  assertEquals(typeof generator.generate, "function");
  assertEquals(typeof generator.generateMany, "function");
});

Deno.test("createMockGenerator - generates valid string", () => {
  const schema = v.string();
  const generator = createMockGenerator(schema);
  
  const result = generator.generate();
  assertEquals(typeof result, "string");
});

Deno.test("createMockGenerator - generates valid number", () => {
  const schema = v.number();
  const generator = createMockGenerator(schema);
  
  const result = generator.generate();
  assertEquals(typeof result, "number");
});

Deno.test("createMockGenerator - generates valid boolean", () => {
  const schema = v.boolean();
  const generator = createMockGenerator(schema);
  
  const result = generator.generate();
  assertEquals(typeof result, "boolean");
});

Deno.test("createMockGenerator - generateMany creates array", () => {
  const schema = v.string();
  const generator = createMockGenerator(schema);
  
  const results = generator.generateMany(3);
  assertEquals(Array.isArray(results), true);
  assertEquals(results.length, 3);
  
  // All results should be strings
  results.forEach(result => {
    assertEquals(typeof result, "string");
  });
});

Deno.test("createMockGenerator - basic object generation", () => {
  const schema = v.object({
    name: v.string(),
    age: v.number(),
    active: v.boolean()
  });
  
  const generator = createMockGenerator(schema);
  const result = generator.generate();
  
  // Check structure
  assertEquals(typeof result, "object");
  assertEquals(typeof result.name, "string");
  assertEquals(typeof result.age, "number");
  assertEquals(typeof result.active, "boolean");
});