import * as v from "valibot";
import { Faker, en } from "@faker-js/faker";
import RandExp from "randexp";

import type {
  MockGeneratorOptions,
  MockGenerator,
  ResolvedMockGeneratorOptions,
} from "./types.ts";
import { SKIP } from "./types.ts";
import { getFakeGenerator } from "./fake.ts";
import { DEFAULT_SEMANTICS, resolveSemantic } from "./semantics.ts";
import { regexToStringMinMax } from "./regex-parser.ts";

const VOID = Symbol("void");

// RandExp draws from Math.random() internally, silently defeating
// `faker: { seed }` for every regex-backed value. Its instance `randInt`
// overrides the prototype's, so route draws through the generator's faker.
function createSeededRandExp(pattern: RegExp | string, faker: Faker): RandExp {
  const randexp = new RandExp(pattern);
  (
    randexp as unknown as { randInt: (a: number, b: number) => number }
  ).randInt = (a, b) => faker.number.int({ min: a, max: b });
  return randexp;
}

const schemaHandlers = {
  union: (schema: any, faker: Faker, context: any, options: any) => {
    const choice = faker.number.int({ min: 0, max: schema.options.length - 1 });
    const chosenSchema = schema.options[choice];
    return handleSchema(chosenSchema, faker, context, options);
  },

  optional: (schema: any, faker: Faker, context: any, options: any) => {
    const shouldBePresent = faker.datatype.boolean();
    if (shouldBePresent) {
      return handleSchema(schema.wrapped, faker, context, options);
    }
    return VOID;
  },

  object: (schema: any, faker: Faker, context: any, options: any) => {
    const result: Record<string, any> = {};
    for (const key in schema.entries) {
      const fieldSchema = schema.entries[key];
      const fieldContext = {
        ...context,
        path: context.path ? `${context.path}.${key}` : key,
      };
      const value = handleSchema(fieldSchema, faker, fieldContext, options);
      if (value !== VOID) {
        result[key] = value;
      }
    }
    return result;
  },

  array: (schema: any, faker: Faker, context: any, options: any) => {
    const minLength =
      schema.pipe?.find((pipe: any) => pipe.type === "min_length")
        ?.requirement ?? 0;
    const explicitMaxLength = schema.pipe?.find(
      (pipe: any) => pipe.type === "max_length",
    )?.requirement;

    const maxLength = Math.max(
      minLength,
      Math.min(
        explicitMaxLength ?? options.defaultArrayMaxLength,
        options.defaultArrayMaxLength,
      ),
    );
    const length = faker.number.int({ min: minLength, max: maxLength });
    const result = [];
    for (let i = 0; i < length; i++) {
      // Index in the path so per-path resolve hooks can address individual
      // items ("refs.0"); the semantic tier ignores numeric segments.
      const itemContext = {
        ...context,
        path: context.path ? `${context.path}.${i}` : `${i}`,
      };
      result.push(handleSchema(schema.item, faker, itemContext, options));
    }
    return result;
  },

  literal: (schema: any) => schema.literal,

  enum: (schema: any, faker: Faker) => {
    const values = Object.values(schema.enum);
    const choice = faker.number.int({ min: 0, max: values.length - 1 });
    return values[choice];
  },

  picklist: (schema: any, faker: Faker) => {
    const choice = faker.number.int({ min: 0, max: schema.options.length - 1 });
    return schema.options[choice];
  },

  string: (schema: any, faker: Faker, context: any, options: any) => {
    const explicitMaxLength = schema.pipe?.find(
      (pipe: any) => pipe.type === "max_length",
    )?.requirement;
    const maxLength = explicitMaxLength ?? options.defaultStringMaxLength;
    const minLength =
      schema.pipe?.find((pipe: any) => pipe.type === "min_length")
        ?.requirement ?? 0;
    // Any validation action carrying a RegExp requirement can drive the
    // regex-based generator — not only `v.regex()`. Valibot ships many
    // regex-backed actions with their own type names (`hex_color`,
    // `iso_date`, `ulid`, `slug`, `hexadecimal`, `nanoid`, …); matching on
    // `type === 'regex'` alone made them fall through to the random-string
    // fallback, which then failed validation until maxAttempts exhausted.
    // Actions with a dedicated faker path above (email/url/uuid/ip,
    // iso_timestamp) return before this branch is reached.
    const regex =
      schema.pipe?.find(
        (pipe: any) =>
          pipe.kind === "validation" && pipe.requirement instanceof RegExp,
      )?.requirement ?? null;
    const isoTimestamp =
      schema.pipe?.find((pipe: any) => pipe.type === "iso_timestamp")
        ?.requirement ?? false;

    // Check for specific validation pipes
    const emailPipe = schema.pipe?.find((pipe: any) => pipe.type === "email");
    const urlPipe = schema.pipe?.find((pipe: any) => pipe.type === "url");
    const uuidPipe = schema.pipe?.find((pipe: any) => pipe.type === "uuid");
    const ipPipe = schema.pipe?.find((pipe: any) => pipe.type === "ip");

    // Generate specific formats
    if (emailPipe) {
      return faker.internet.email();
    }

    if (urlPipe) {
      return faker.internet.url();
    }

    if (uuidPipe) {
      return faker.string.uuid();
    }

    if (ipPipe) {
      return faker.internet.ip();
    }

    if (isoTimestamp) {
      return faker.date.past().toISOString();
    }

    if (regex) {
      const result = regexToStringMinMax(regex, minLength, maxLength, {
        preferLazy: false,
        generateCandidates: true,
        candidateCount: 5,
      });

      if (result.candidates && result.candidates.length > 0) {
        const randomIndex = faker.number.int({
          min: 0,
          max: result.candidates.length - 1,
        });
        const selectedCandidate = result.candidates[randomIndex];

        if (selectedCandidate) {
          const randexp = createSeededRandExp(selectedCandidate.regex, faker);
          randexp.max = selectedCandidate.maxLength ?? maxLength;

          const generated = randexp.gen();
          return generated;
        }
      }

      const randexp = createSeededRandExp(result.transformed, faker);
      randexp.max = result.actualMaxLength ?? maxLength;
      const generated = randexp.gen();
      return generated;
    }

    // Semantic tier: an unconstrained string whose ENTRY KEY carries meaning
    // (firstname, email, city…) gets a realistic value. Runs after every
    // validator-driven branch above (constraints win) and before the random
    // fallback. Length bounds: only an EXPLICIT max_length constrains a
    // semantic value — the DEFAULT cap exists to bound random noise, not to
    // mutilate realistic values (a truncated email is invalid). Out of
    // bounds → REGENERATE a few times, else fall through to the random
    // generator (never emit a truncated/invalid value).
    if (options.semantics) {
      // Numeric segments are array/tuple indices, not keys: for "email.0" the
      // meaningful key is still "email", so items inherit the enclosing key's semantic.
      const key =
        typeof context?.path === "string"
          ? context.path
              .split(".")
              .filter((segment: string) => !/^\d+$/.test(segment))
              .pop()
          : undefined;
      const semantic = resolveSemantic(key, options.semantics);
      if (semantic) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const value = String(semantic(faker));
          if (
            value.length >= minLength &&
            (explicitMaxLength === undefined ||
              value.length <= explicitMaxLength)
          ) {
            return value;
          }
        }
      }
    }

    const length = faker.number.int({
      min: Math.max(0, minLength),
      max: Math.min(maxLength, options.defaultStringMaxLength),
    });
    return faker.string.alphanumeric(length);
  },

  number: (schema: any, faker: Faker) => {
    const minValue =
      schema.pipe?.find((pipe: any) => pipe.type === "min_value")
        ?.requirement ?? -1000;
    const maxValue =
      schema.pipe?.find((pipe: any) => pipe.type === "max_value")
        ?.requirement ?? 1000;
    const min =
      schema.pipe?.find((pipe: any) => pipe.type === "min")?.requirement ??
      minValue;
    const max =
      schema.pipe?.find((pipe: any) => pipe.type === "max")?.requirement ??
      maxValue;
    const integer = schema.pipe?.find((pipe: any) => pipe.type === "integer");

    if (integer) {
      return faker.number.int({ min: Math.ceil(min), max: Math.floor(max) });
    }

    return faker.number.float({ min, max });
  },

  bigint: (schema: any, faker: Faker) => {
    const min =
      schema.pipe?.find((pipe: any) => pipe.type === "min")?.requirement ??
      -1000n;
    const max =
      schema.pipe?.find((pipe: any) => pipe.type === "max")?.requirement ??
      1000n;

    const numMin = typeof min === "bigint" ? Number(min) : -1000;
    const numMax = typeof max === "bigint" ? Number(max) : 1000;

    return BigInt(faker.number.int({ min: numMin, max: numMax }));
  },

  boolean: (_schema: any, faker: Faker) => faker.datatype.boolean(),

  date: (_schema: any, faker: Faker) => faker.date.past(),

  nullable: (schema: any, faker: Faker, context: any, options: any) => {
    const shouldBeNull = faker.datatype.boolean({ probability: 0.2 });
    if (shouldBeNull) {
      return null;
    }
    return handleSchema(schema.wrapped, faker, context, options);
  },

  nullish: (schema: any, faker: Faker, context: any, options: any) => {
    const choice = faker.number.int({ min: 0, max: 2 });
    if (choice === 0) return null;
    if (choice === 1) return undefined;
    return handleSchema(schema.wrapped, faker, context, options);
  },

  record: (schema: any, faker: Faker, context: any, options: any) => {
    const keyCount = faker.number.int({ min: 1, max: 5 });
    const result: Record<string, any> = {};

    for (let i = 0; i < keyCount; i++) {
      const key = handleSchema(schema.key, faker, context, options);
      result[key] = handleSchema(schema.value, faker, context, options);
    }

    return result;
  },

  map: (schema: any, faker: Faker, context: any, options: any) => {
    const size = faker.number.int({ min: 0, max: 5 });
    const result = new Map();

    for (let i = 0; i < size; i++) {
      const key = handleSchema(schema.key, faker, context, options);
      const value = handleSchema(schema.value, faker, context, options);
      result.set(key, value);
    }

    return result;
  },

  set: (schema: any, faker: Faker, context: any, options: any) => {
    const size = faker.number.int({ min: 0, max: 5 });
    const result = new Set();

    for (let i = 0; i < size; i++) {
      result.add(handleSchema(schema.value, faker, context, options));
    }

    return result;
  },

  tuple: (schema: any, faker: Faker, context: any, options: any) => {
    return schema.items.map((itemSchema: any, index: number) => {
      const itemContext = {
        ...context,
        path: context.path ? `${context.path}.${index}` : `${index}`,
      };
      return handleSchema(itemSchema, faker, itemContext, options);
    });
  },

  variant: (schema: any, faker: Faker, context: any, options: any) => {
    const options_list = Object.values(schema.options);
    const choice = faker.number.int({ min: 0, max: options_list.length - 1 });
    return handleSchema(options_list[choice], faker, context, options);
  },

  intersect: (schema: any, faker: Faker, context: any, options: any) => {
    // Pour l'intersection, on génère et merge les résultats
    const results = schema.options.map((optionSchema: any) =>
      handleSchema(optionSchema, faker, context, options),
    );

    // Si tous sont des objets, on les merge
    if (
      results.every(
        (r: any) => typeof r === "object" && r !== null && !Array.isArray(r),
      )
    ) {
      return Object.assign({}, ...results);
    }

    return results[0];
  },

  lazy: (schema: any, faker: Faker, context: any, options: any) => {
    const resolvedSchema = schema.getter({});
    return handleSchema(resolvedSchema, faker, context, options);
  },

  custom: (_schema: any, faker: Faker) => faker.lorem.word(),
  brand: (schema: any, faker: Faker, context: any, options: any) => {
    // Brand schemas wrap another schema in the 'name' property
    return handleSchema(schema.name, faker, context, options);
  },
  unknown: (_schema: any, faker: Faker) => faker.lorem.word(),
  any: (_schema: any, faker: Faker) => faker.lorem.word(),

  null: () => null,
  undefined: () => undefined,
  void: () => undefined,
  never: () => {
    throw new Error("Never schema cannot be generated");
  },

  file: (_schema: any, faker: Faker) => {
    const fileName = faker.system.fileName();
    const content = faker.lorem.paragraphs();
    const blob = new Blob([content], { type: "text/plain" });
    return new File([blob], fileName, { type: "text/plain" });
  },

  blob: (_schema: any, faker: Faker) => {
    const content = faker.lorem.paragraphs();
    return new Blob([content], { type: "text/plain" });
  },
};

// loose/strict objects expose the same .entries shape as object — identical
// generation (a loose object's mock needs no extra unknown keys; a strict
// object's mock must not have any).
(schemaHandlers as Record<string, unknown>)["loose_object"] =
  schemaHandlers["object"];
(schemaHandlers as Record<string, unknown>)["strict_object"] =
  schemaHandlers["object"];

function handleSchema(
  schema: any,
  faker: Faker,
  context: any,
  options: any,
): any {
  if (!schema) {
    console.error("Schema is undefined!");
    return faker.lorem.word();
  }

  // Keep the original schema for validation (includes all constraints)
  const originalSchema = schema;

  // Handle piped schemas that contain another complete schema (recursively)
  // This happens when you do: v.pipe(existingSchema, v.metadata(...))
  // We need to unwrap nested pipes to find the actual base schema for type detection
  // BUT we need to preserve all pipe constraints from outer schemas
  const allPipeItems: any[] = [];
  while (schema.pipe && Array.isArray(schema.pipe)) {
    const firstItem = schema.pipe[0];
    // If the first item in the pipe is itself a complete schema with its own pipe
    if (
      firstItem &&
      typeof firstItem === "object" &&
      firstItem.pipe &&
      firstItem.type === schema.type
    ) {
      // Collect non-schema pipe items from current level (like metadata)
      const nonSchemaPipes = schema.pipe.slice(1);
      allPipeItems.unshift(...nonSchemaPipes);
      // Use the nested schema as the base for generation
      schema = firstItem;
    } else {
      // No more nested schemas, collect all remaining pipes
      allPipeItems.unshift(...schema.pipe);
      break;
    }
  }

  // If we unwrapped schemas, reconstruct the pipe with all constraints
  if (allPipeItems.length > 0 && schema !== originalSchema) {
    schema = { ...schema, pipe: allPipeItems };
  }

  // Caller-side hook, ranked above fake()/semantics: the CALLER has
  // generation-time knowledge the schema author cannot (e.g. correlated ids).
  // Runs after pipe unwrapping so `schema.pipe` exposes RegExp requirements; SKIP falls through.
  if (options.resolve) {
    const resolved = options.resolve({
      schema,
      path: context?.path ?? "",
      faker,
    });
    if (resolved !== SKIP) {
      // Same validation gate as generated values — silently accepting an
      // invalid injected value is exactly the generate(overrides) flaw this
      // hook must not reproduce.
      const valid = v.safeParse(originalSchema, resolved);
      if (!valid.success) {
        const details = valid.issues.map((issue) => issue.message).join("; ");
        throw new Error(
          `resolve() returned an invalid value at path "${context?.path ?? ""}" (schema type "${schema.type}"): ${details}`,
        );
      }
      return valid.output;
    }
  }

  // First, check if schema has a custom fake generator
  const customGenerator = getFakeGenerator(schema);
  if (customGenerator) {
    try {
      let maxAttempts = options.maxAttempts;
      let result = null;
      while (maxAttempts > 0) {
        result = customGenerator(faker, context);
        if (result === VOID) {
          result = undefined;
        }
        const valid = v.safeParse(originalSchema, result);
        if (valid.success) {
          return valid.output;
        }
        maxAttempts--;
      }
      console.error(
        `Failed to generate valid value using custom fake generator`,
        result,
      );
      throw new Error(`Max attempts reached using custom fake generator`);
    } catch (error) {
      console.warn(
        "Custom fake generator failed, falling back to default handlers:",
        error,
      );
      // Fall through to default handlers
    }
  }

  // Use default handlers
  const handler = schemaHandlers[schema.type as keyof typeof schemaHandlers];
  if (handler) {
    let maxAttempts = options.maxAttempts;
    let result = null;
    while (maxAttempts > 0) {
      result = handler(schema, faker, context, options);
      if (result === VOID) {
        result = undefined;
      }
      const valid = v.safeParse(originalSchema, result);
      if (valid.success) {
        return valid.output;
      }
      maxAttempts--;
    }
    console.error(
      `Failed to generate valid value for schema type:`,
      schema,
      result,
    );
    throw new Error(`Max attempts reached for schema type: ${schema.type}`);
  } else {
    console.warn(`No handler for type: ${schema.type}`);
    return faker.lorem.word();
  }
}

/**
 * Creates a mock generator from a Valibot schema
 *
 * @param schema - The Valibot schema to use for generation
 * @param options - Configuration options
 * @returns A mock generator
 */
export function createMockGenerator<TSchema extends v.GenericSchema>(
  schema: TSchema,
  options: MockGeneratorOptions = {},
): MockGenerator<TSchema> {
  const resolvedOptions: ResolvedMockGeneratorOptions = {
    // Merge over the locale default: a partial `{ seed }` must not drop the
    // locale (Faker's constructor requires one).
    faker: new Faker({ locale: [en], ...(options.faker ?? {}) }),
    maxAttempts: options.maxAttempts ?? 100,
    defaultArrayMaxLength: options.defaultArrayMaxLength ?? 10,
    defaultStringMaxLength: options.defaultStringMaxLength ?? 20,
    semantics:
      options.semantics === false
        ? null
        : { ...DEFAULT_SEMANTICS, ...(options.semantics ?? {}) },
    resolve: options.resolve ?? null,
  };
  // The documented `seed` option — Faker's constructor ignores it; it must be
  // applied explicitly for deterministic output.
  if (options.faker?.seed !== undefined) {
    resolvedOptions.faker.seed(options.faker.seed);
  }

  function generate(
    overrides?: Partial<v.InferOutput<TSchema>>,
  ): v.InferOutput<TSchema> {
    const context = { path: "" };
    const result = handleSchema(
      schema,
      resolvedOptions.faker,
      context,
      resolvedOptions,
    );
    // For object schemas, `overrides` replace the corresponding generated fields.
    // This is the first-class way to inject referential-integrity values
    // (existing ids), fixed enums, or any caller-controlled value — instead of
    // spread-merging the result after the fact.
    if (
      overrides &&
      result !== null &&
      typeof result === "object" &&
      !Array.isArray(result)
    ) {
      return { ...result, ...overrides };
    }
    return result;
  }

  function generateMany(
    count: number,
    overrides?:
      | Partial<v.InferOutput<TSchema>>
      | ((index: number) => Partial<v.InferOutput<TSchema>>),
  ): v.InferOutput<TSchema>[] {
    return Array.from({ length: count }, (_unused, index) =>
      generate(typeof overrides === "function" ? overrides(index) : overrides),
    );
  }

  return {
    generate,
    generateMany,
  };
}
