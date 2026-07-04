import type { Faker } from "@faker-js/faker";

/**
 * Semantic field-name generation — the "zero-declaration realistic tier".
 *
 * A plain `v.string()` carries no hint about WHAT it holds, so the generator
 * falls back to random alphanumerics. But the field's KEY very often does:
 * `firstname`, `email`, `city`… This module maps normalized entry keys to
 * realistic faker generators, applied only when no stronger signal exists
 * (explicit `fake()` metadata and validator pipes like `v.email()` always win).
 *
 * Locale-aware by construction: generators go through the SAME faker instance
 * as everything else, so `{ faker: { locale: [locales.fr], seed } }` yields
 * French names, deterministically.
 */
export type SemanticGenerator = (faker: Faker) => string;

/** Lowercase + strip every non-letter: `first_name`, `First-Name`, `firstName`
 *  all normalize to `firstname`. */
export function normalizeSemanticKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Built-in table (normalized key → generator). Deliberately conservative:
 * only keys whose meaning is unambiguous across domains. Ambiguous ones
 * (`name`, `displayName` — person or company?) are left to the consumer via
 * the `semantics` option.
 */
export const DEFAULT_SEMANTICS: Readonly<Record<string, SemanticGenerator>> = {
  firstname: (f) => f.person.firstName(),
  prenom: (f) => f.person.firstName(),
  lastname: (f) => f.person.lastName(),
  surname: (f) => f.person.lastName(),
  fullname: (f) => f.person.fullName(),
  username: (f) => f.internet.username(),
  email: (f) => f.internet.email(),
  mail: (f) => f.internet.email(),
  phone: (f) => f.phone.number(),
  telephone: (f) => f.phone.number(),
  mobile: (f) => f.phone.number(),
  city: (f) => f.location.city(),
  ville: (f) => f.location.city(),
  country: (f) => f.location.country(),
  pays: (f) => f.location.country(),
  address: (f) => f.location.streetAddress(),
  adresse: (f) => f.location.streetAddress(),
  street: (f) => f.location.streetAddress(),
  zipcode: (f) => f.location.zipCode(),
  postalcode: (f) => f.location.zipCode(),
  codepostal: (f) => f.location.zipCode(),
  company: (f) => f.company.name(),
  entreprise: (f) => f.company.name(),
  organization: (f) => f.company.name(),
  organisation: (f) => f.company.name(),
  jobtitle: (f) => f.person.jobTitle(),
  position: (f) => f.person.jobTitle(),
  poste: (f) => f.person.jobTitle(),
  description: (f) => f.lorem.sentence(),
  summary: (f) => f.lorem.sentence(),
  bio: (f) => f.lorem.sentence(),
  website: (f) => f.internet.url(),
  color: (f) => f.color.rgb(),
  couleur: (f) => f.color.rgb(),
};

/**
 * Resolve the generator for an entry key, custom table first (consumer
 * overrides/extends the defaults), or null when the key carries no known
 * semantic.
 */
export function resolveSemantic(
  key: string | undefined,
  custom?: Readonly<Record<string, SemanticGenerator>>,
): SemanticGenerator | null {
  if (!key) return null;
  const normalized = normalizeSemanticKey(key);
  if (!normalized) return null;
  return custom?.[normalized] ?? DEFAULT_SEMANTICS[normalized] ?? null;
}
