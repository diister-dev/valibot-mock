# @diister/valibot-mock

> Mock data generator for Valibot schemas

This package allows you to automatically generate valid test data from [Valibot](https://valibot.dev) schemas using [Faker.js](https://fakerjs.dev) to create realistic values.

## ✨ Features

- 🎯 **Automatic generation**: Creates valid data based on your Valibot schemas
- 🌍 **Multi-language support**: Uses Faker.js with locale support
- 🔧 **Configurable**: Customizable options (seed, attempts, sizes)
- 📦 **Extensive type support**: Wide support for Valibot types (primitives, objects, arrays, unions, etc.)
- ⚡ **Performant**: Built-in validation with automatic retry

## 📋 Supported types

### Primitive types
- `string`, `number`, `boolean`, `date`, `bigint`
- Pipe support: `minLength`, `maxLength`, `regex`, `min`, `max`, `integer`, `isoTimestamp`

### Collection types
- `array`, `object`, `record`, `map`, `set`, `tuple`

### Choice types
- `union`, `enum`, `picklist`, `literal`, `variant`

### Modifier types
- `optional`, `nullable`, `nullish`, `nonNullable`, `nonNullish`, `nonOptional`
- `brand` - for branded/tagged types

### Special types
- `lazy`, `intersect`, `custom`, `unknown`, `any`
- `null`, `undefined`, `void`, `never`
- `file`, `blob`

## 🚀 Installation

```bash
# With Deno
deno add @diister/valibot-mock

# With npm/pnpm/yarn
npx jsr add @diister/valibot-mock
```

## 💡 Usage

### Basic example

```ts
import * as v from "valibot";
import { createMockGenerator } from "@diister/valibot-mock";

const UserSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^user:[A-Z0-9]{16}$/)),
  email: v.pipe(v.string(), v.email()),
  firstName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(32))),
  lastName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(32))),
  age: v.pipe(v.number(), v.integer(), v.min(18), v.max(120)),
  status: v.enum(["active", "inactive", "pending"]),
  roles: v.array(v.string()),
  createdAt: v.pipe(v.string(), v.isoTimestamp())
});

const generator = createMockGenerator(UserSchema);

// Generate a single user
const mockUser = generator.generate();
console.log(mockUser);

// Generate multiple users
const mockUsers = generator.generateMany(5);
console.log(mockUsers);
```

### Advanced Usage

### Custom Data Generation with `fake()`

For more realistic data generation, you can use the `fake()` function to provide custom generators:

```typescript
import * as v from "valibot";
import { createMockGenerator, fake } from "@diister/valibot-mock";

const UserSchema = v.object({
  // Use fake() for custom realistic data generation
  firstName: v.pipe(
    v.string(),
    v.minLength(2),
    fake((faker, context) => {
      console.log(`Generating firstName at ${context.path}`);
      return faker.person.firstName();
    })
  ),
  lastName: v.pipe(
    v.string(),
    fake((faker) => faker.person.lastName())
  ),
  email: v.pipe(
    v.string(),
    v.email(),
    fake((faker) => faker.internet.email())
  ),
  // Fields without fake() use intelligent defaults
  age: v.pipe(
    v.number(),
    v.minValue(18),
    v.maxValue(80)
  ),
  bio: v.optional(v.pipe(
    v.string(),
    v.maxLength(500),
    fake((faker) => faker.person.bio())
  ))
});

const mockGenerator = createMockGenerator(UserSchema);
const userData = mockGenerator.generate();

// Output:
// {
//   firstName: "John",
//   lastName: "Doe", 
//   email: "john.doe@example.com",
//   age: 25.4,
//   bio: "Software engineer and coffee enthusiast"
// }
```

### Fake Generator Function

The `fake()` function accepts a generator function with two parameters:

```typescript
fake((faker, context) => {
  // faker: Faker.js instance with full API
  // context: { path: string } - current field path for debugging
  return faker.datatype.uuid();
})
```

### Combining with Locale Support

```ts
import { createMockGenerator, locales } from "@diister/valibot-mock";

const generator = createMockGenerator(UserSchema, {
  faker: { 
    locale: [locales.fr], 
    seed: 42 
  },
  maxAttempts: 15, // Number of attempts to generate a valid value
  defaultArrayMaxLength: 5, // Max size for arrays by default
  defaultStringMaxLength: 100 // Max size for strings by default
});
```

## 📖 API

### `createMockGenerator<T>(schema, options?)`

Creates a mock generator for a given schema.

#### Parameters

- `schema`: The Valibot schema to use
- `options?`: Configuration options

#### Options

```ts
interface MockGeneratorOptions {
  faker?: {
    locale?: LocaleDefinition[];     // Faker locales (use exported locales)
    seed?: number;                   // Seed for reproducible results
  };
  maxAttempts?: number;             // Max attempts (default: 10)
  defaultArrayMaxLength?: number;   // Max array size (default: 10)
  defaultStringMaxLength?: number;  // Max string size (default: 1048575)
}
```

#### Returns

A `MockGenerator` object with methods:
- `generate()`: Generate a single value
- `generateMany(count)`: Generate multiple values

### `fake(generatorFn)`

Creates custom data generators for more realistic mock data.

#### Parameters

- `generatorFn`: Function `(faker, context) => any`
  - `faker`: Full Faker.js instance
  - `context`: Object with `path` property for current field location

#### Example

```typescript
fake((faker, context) => {
  // Use any Faker.js method
  return faker.person.firstName();
})
```

### Exported locales

```ts
import { locales } from "@diister/valibot-mock";

// Available locales
locales.en    // English
locales.fr    // French
locales.de    // German
locales.es    // Spanish
locales.it    // Italian
locales.ja    // Japanese
locales.ko    // Korean
locales.pt    // Portuguese
locales.ru    // Russian
locales.zh    // Chinese
// ... and many more
```

## 🔧 Development

This package is under active development. The API may evolve before version 1.0.

## 📄 License

MIT