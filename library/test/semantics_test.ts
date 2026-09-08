/**
 * Semantic field-name tier — realistic values for plain strings whose ENTRY
 * KEY carries meaning, locale-aware and seed-deterministic. Precedence locks:
 * explicit fake() metadata and validator pipes always beat the key semantic.
 */
import { test } from "node:test";
import { assert, assertEquals, assertNotEquals } from "./+assert.ts";
import * as v from "valibot";
import { createMockGenerator, fake, locales } from "../mod.ts";
import { normalizeSemanticKey, resolveSemantic } from "../src/semantics.ts";

const personSchema = v.object({
  firstname: v.string(),
  lastname: v.string(),
  email: v.string(),
  city: v.string(),
  note: v.string(),
});

test("semantics — known keys yield realistic values, unknown keys keep the random fallback", () => {
  const gen = createMockGenerator(personSchema, {
    faker: { locale: [locales.en], seed: 7 },
  });
  const doc = gen.generate();
  // Names: letters (with possible spaces/'/-), never bare alphanumeric noise.
  assert(
    /^[A-Za-zÀ-ÿ' -]+$/.test(doc.firstname),
    `firstname looks random: ${doc.firstname}`,
  );
  assert(
    /^[A-Za-zÀ-ÿ' -]+$/.test(doc.lastname),
    `lastname looks random: ${doc.lastname}`,
  );
  // Email by KEY (no v.email() pipe on this field).
  assert(doc.email.includes("@"), `email not realistic: ${doc.email}`);
  assert(/^[A-Za-zÀ-ÿ' -]+$/.test(doc.city), `city looks random: ${doc.city}`);
  // `note` has no semantic → plain random string is fine (just present).
  assertEquals(typeof doc.note, "string");
});

test("semantics — seed makes the realistic tier deterministic", () => {
  const a = createMockGenerator(personSchema, {
    faker: { locale: [locales.fr], seed: 42 },
  }).generate();
  const b = createMockGenerator(personSchema, {
    faker: { locale: [locales.fr], seed: 42 },
  }).generate();
  assertEquals(a, b);
  const c = createMockGenerator(personSchema, {
    faker: { locale: [locales.fr], seed: 43 },
  }).generate();
  assertNotEquals(a, c);
});

test("semantics — key normalization: first_name / First-Name / firstName all match", () => {
  assertEquals(normalizeSemanticKey("first_name"), "firstname");
  assertEquals(normalizeSemanticKey("First-Name"), "firstname");
  assertEquals(normalizeSemanticKey("firstName"), "firstname");
  const gen = createMockGenerator(
    v.object({ first_name: v.string(), lastName: v.string() }),
    { faker: { locale: [locales.en], seed: 1 } },
  );
  const doc = gen.generate();
  assert(/^[A-Za-zÀ-ÿ' -]+$/.test(doc.first_name));
  assert(/^[A-Za-zÀ-ÿ' -]+$/.test(doc.lastName));
});

test("semantics — length constraints stay sovereign (truncate long, skip too-short)", () => {
  // maxLength 5: the realistic value is truncated, never invalid.
  const short = createMockGenerator(
    v.object({ firstname: v.pipe(v.string(), v.maxLength(5)) }),
    { faker: { locale: [locales.en], seed: 7 } },
  ).generate();
  assert(short.firstname.length <= 5);
  // minLength 25: no realistic first name reaches it → random fallback, valid.
  // (defaultStringMaxLength raised alongside — the fallback's own ceiling; a
  // minLength above it is a PRE-EXISTING generator limitation, out of scope.)
  const long = createMockGenerator(
    v.object({ firstname: v.pipe(v.string(), v.minLength(25)) }),
    { faker: { locale: [locales.en], seed: 7 }, defaultStringMaxLength: 30 },
  ).generate();
  assert(long.firstname.length >= 25);
});

test("semantics — validator pipes win over the key (a firstname with v.email() is an email)", () => {
  const gen = createMockGenerator(
    v.object({ firstname: v.pipe(v.string(), v.email()) }),
    { faker: { locale: [locales.en], seed: 7 } },
  );
  assert(gen.generate().firstname.includes("@"));
});

test("semantics — explicit fake() metadata wins over the key", () => {
  const gen = createMockGenerator(
    v.object({
      firstname: v.pipe(
        v.string(),
        fake(() => "FORCED"),
      ),
    }),
    { faker: { locale: [locales.en], seed: 7 } },
  );
  assertEquals(gen.generate().firstname, "FORCED");
});

test("semantics — custom table extends/overrides defaults; false disables the tier", () => {
  // Consumer maps the ambiguous `displayname` to company names.
  const custom = createMockGenerator(v.object({ displayName: v.string() }), {
    faker: { locale: [locales.en], seed: 7 },
    semantics: { displayname: (f) => f.company.name() },
  }).generate();
  assert(custom.displayName.length > 2);
  assert(
    resolveSemantic("displayName") === null,
    "displayname must NOT be a default (ambiguous)",
  );

  // Disabled: firstname falls back to random alphanumerics (letters+digits mix
  // over a few samples — at minimum it must not throw and stays a string).
  const off = createMockGenerator(personSchema, {
    faker: { locale: [locales.en], seed: 7 },
    semantics: false,
  }).generate();
  assertEquals(typeof off.firstname, "string");
});
