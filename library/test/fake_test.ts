import { assertEquals } from "@std/assert";
import * as v from "valibot";
import { fake, getFakeGenerator } from "../src/fake.ts";
import type { Faker } from "@faker-js/faker";
import type { FakeGeneratorFn } from "../src/types.ts";

Deno.test("fake function - basic functionality", () => {
  const generator: FakeGeneratorFn<string> = (faker: Faker) => faker.person.firstName();
  const result = fake(generator);
  
  // The result should be a metadata action
  assertEquals(typeof result, "object");
  assertEquals(result.type, "metadata");
});

Deno.test("fake function - preserves generator in metadata", () => {
  const generator: FakeGeneratorFn<string> = (faker: Faker) => faker.person.firstName();
  const result = fake(generator);
  
  // Check that metadata contains our generator
  const metadata = result.metadata;
  const key = Symbol.for("fake_generator");
  assertEquals(metadata[key], generator);
});

Deno.test("getFakeGenerator - returns null for schema without fake metadata", () => {
  const schema = v.string();
  const extracted = getFakeGenerator<string>(schema);
  assertEquals(extracted, null);
});

Deno.test("fake function - works with different generator types", () => {
  // String generator
  const stringGenerator: FakeGeneratorFn<string> = (faker: Faker) => faker.person.lastName();
  const stringResult = fake(stringGenerator);
  assertEquals(stringResult.type, "metadata");

  // Number generator  
  const numberGenerator: FakeGeneratorFn<number> = (faker: Faker) => faker.number.int({ min: 1, max: 100 });
  const numberResult = fake(numberGenerator);
  assertEquals(numberResult.type, "metadata");

  // Boolean generator
  const booleanGenerator: FakeGeneratorFn<boolean> = () => Math.random() > 0.5;
  const booleanResult = fake(booleanGenerator);
  assertEquals(booleanResult.type, "metadata");
});