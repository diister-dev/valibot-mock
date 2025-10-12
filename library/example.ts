import * as v from "valibot";
import { createMockGenerator, locales } from "./mod.ts";

// Define a complex user schema with validation rules
const UserSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: v.pipe(v.string(), v.minLength(2), v.maxLength(50)),
  email: v.pipe(v.string(), v.email()),
  age: v.pipe(v.number(), v.integer(), v.minValue(18), v.maxValue(120)),
  isActive: v.boolean(),
  tags: v.array(v.string()),
  profile: v.optional(v.object({
    bio: v.pipe(v.string(), v.maxLength(500)),
    website: v.optional(v.pipe(v.string(), v.url())),
    social: v.record(v.string(), v.string())
  })),
  role: v.picklist(['admin', 'user', 'moderator']),
  permissions: v.union([
    v.literal('read'),
    v.literal('write'),
    v.literal('admin')
  ]),
  metadata: v.nullable(v.record(v.string(), v.unknown()))
});

console.log("=== Valibot Mock Generator Example ===\n");

// Basic usage with default English locale
console.log("1. Basic usage (English locale):");
const basicGenerator = createMockGenerator(UserSchema);
const basicUser = basicGenerator.generate();
console.log(JSON.stringify(basicUser, null, 2));

// Usage with French locale
console.log("\n2. With French locale:");
const frenchGenerator = createMockGenerator(UserSchema, {
  faker: {
    locale: [locales.fr, locales.en], // Fallback to English if French data not available
    seed: 12345 // For reproducible results
  }
});
const frenchUser = frenchGenerator.generate();
console.log(JSON.stringify(frenchUser, null, 2));

// Generate multiple users
console.log("\n3. Generate multiple users:");
const multipleUsers = basicGenerator.generateMany(3);
multipleUsers.forEach((user, index) => {
  console.log(`User ${index + 1}:`, JSON.stringify(user, null, 2));
});

// Complex schema with various types
const ComplexSchema = v.object({
  stringField: v.pipe(v.string(), v.regex(/^[A-Z]{3}-\d{4}$/)), // Custom regex pattern
  optionalField: v.optional(v.string()),
  nullableField: v.nullable(v.number()),
  arrayField: v.pipe(v.array(v.string()), v.minLength(2), v.maxLength(5)),
  enumField: v.enum({ RED: 'red', GREEN: 'green', BLUE: 'blue' }),
  unionField: v.union([v.string(), v.number()]),
  dateField: v.date(),
  bigintField: v.bigint()
});

console.log("\n4. Complex schema with various Valibot types:");
const complexGenerator = createMockGenerator(ComplexSchema, {
  faker: {
    locale: [locales.de, locales.en],
    seed: 42
  },
  maxAttempts: 20, // Higher attempts for complex regex
  defaultArrayMaxLength: 5
});

const complexData = complexGenerator.generate();
console.log(JSON.stringify(complexData, (_key, value) => {
  // Handle BigInt serialization
  return typeof value === 'bigint' ? value.toString() + 'n' : value;
}, 2));

console.log("\n=== Example completed successfully! ===");

const optionalAny = v.optional(v.any());
const optionalUnknown = v.optional(v.unknown());

const generation = createMockGenerator(optionalAny).generate();
console.log("Generated optional any:", generation);