import { assertEquals, assertExists } from "@std/assert";
import {
  parseRegex,
  estimateMinLength,
  estimateMaxLength,
  regexToStringMinMax,
  analyzeRegex,
} from "../src/regex-parser.ts";

Deno.test("parseRegex - parses RegExp object", () => {
  const regex = /^[a-z]+$/i;
  const parsed = parseRegex(regex);
  
  assertEquals(parsed.source, "^[a-z]+$");
  assertEquals(parsed.flags.raw, "i");
  assertExists(parsed.pattern);
  assertExists(parsed.ast);
});

Deno.test("parseRegex - parses string regex", () => {
  const regex = "^[0-9]{3}$";
  const parsed = parseRegex(regex);
  
  assertEquals(parsed.source, "^[0-9]{3}$");
  assertExists(parsed.pattern);
});

Deno.test("parseRegex - parses string with delimiters", () => {
  const regex = "/^test$/g";
  const parsed = parseRegex(regex);
  
  assertEquals(parsed.source, "^test$");
  assertEquals(parsed.flags.raw, "g");
});

Deno.test("estimateMinLength - simple literal", () => {
  const min = estimateMinLength(/hello/);
  assertEquals(min, 5);
});

Deno.test("estimateMinLength - with + quantifier", () => {
  const min = estimateMinLength(/[a-z]+/);
  assertEquals(min, 1);
});

Deno.test("estimateMinLength - with * quantifier", () => {
  const min = estimateMinLength(/[a-z]*/);
  assertEquals(min, 0);
});

Deno.test("estimateMinLength - with {n,m} quantifier", () => {
  const min = estimateMinLength(/[0-9]{3,5}/);
  assertEquals(min, 3);
});

Deno.test("estimateMinLength - with {n} exact quantifier", () => {
  const min = estimateMinLength(/[0-9]{9}/);
  assertEquals(min, 9);
});

Deno.test("estimateMinLength - complex email regex", () => {
  const min = estimateMinLength(/^[a-z]+@[a-z]+\.[a-z]+$/);
  assertEquals(min, 5); // a@b.c
});

Deno.test("estimateMinLength - with optional groups", () => {
  const min = estimateMinLength(/^[a-z]+(\.[a-z]+)*@[a-z]+$/);
  assertEquals(min, 3); // a@b
});

Deno.test("estimateMinLength - with anchors only", () => {
  const min = estimateMinLength(/^$/);
  assertEquals(min, 0); // Anchors don't consume characters
});

Deno.test("estimateMaxLength - finite quantifier", () => {
  const max = estimateMaxLength(/[a-z]{1,3}/);
  assertEquals(max, 3);
});

Deno.test("estimateMaxLength - infinite with +", () => {
  const max = estimateMaxLength(/[a-z]+/);
  assertEquals(max, null); // Infinite
});

Deno.test("estimateMaxLength - infinite with *", () => {
  const max = estimateMaxLength(/[a-z]*/);
  assertEquals(max, null); // Infinite
});

Deno.test("estimateMaxLength - exact quantifier", () => {
  const max = estimateMaxLength(/[0-9]{14}/);
  assertEquals(max, 14);
});

Deno.test("estimateMaxLength - literal string", () => {
  const max = estimateMaxLength(/hello/);
  assertEquals(max, 5);
});

Deno.test("regexToStringMinMax - generates candidates", () => {
  const result = regexToStringMinMax(/^[0-9]+$/, 5, 10, {
    generateCandidates: true,
    candidateCount: 3,
  });
  
  assertExists(result.candidates);
  assertEquals(result.candidates!.length, 3);
  
  // Check that all candidates are within range
  for (const candidate of result.candidates!) {
    assertEquals(candidate.minLength >= 5 && candidate.minLength <= 10, true);
  }
});

Deno.test("regexToStringMinMax - exact length", () => {
  const result = regexToStringMinMax(/^[0-9]+$/, 9, 9, {
    generateCandidates: true,
    candidateCount: 1,
  });
  
  assertExists(result.candidates);
  assertEquals(result.candidates!.length, 1);
  assertEquals(result.candidates![0]!.minLength, 9);
  assertEquals(result.candidates![0]!.maxLength, 9);
});

Deno.test("regexToStringMinMax - warns when min > maxLength", () => {
  const result = regexToStringMinMax(/^[a-z]{20}$/, 5, 10);
  
  assertExists(result.warning);
  assertEquals(result.warning!.includes("Cannot meet maxLength"), true);
});

Deno.test("regexToStringMinMax - email regex with range", () => {
  // Use a simpler email regex for this test
  const result = regexToStringMinMax(
    /^[a-z]+@[a-z]+\.[a-z]+$/,
    5,
    50,
    {
      generateCandidates: true,
      candidateCount: 5,
    }
  );
  
  assertExists(result.candidates);
  assertEquals(result.candidates!.length, 5);
  
  // All candidates should be within the specified range
  for (const candidate of result.candidates!) {
    assertEquals(candidate.minLength >= 5, true);
    assertEquals(candidate.minLength <= 50, true);
  }
});

Deno.test("analyzeRegex - simple regex", () => {
  const analysis = analyzeRegex(/^[a-z]+$/);
  
  assertEquals(analysis.hasBackreferences, false);
  assertEquals(analysis.hasLookarounds, false);
  assertEquals(analysis.hasNamedGroups, false);
  assertEquals(analysis.captureGroupCount, 0);
  assertEquals(analysis.minLength, 1);
  assertEquals(analysis.maxLength, null);
  assertEquals(analysis.flags, "");
});

Deno.test("analyzeRegex - with capturing groups", () => {
  const analysis = analyzeRegex(/^(hello)\s+(world)$/);
  
  assertEquals(analysis.captureGroupCount, 2);
  assertEquals(analysis.hasNamedGroups, false);
});

Deno.test("analyzeRegex - with named groups", () => {
  const analysis = analyzeRegex(/(?<year>\d{4})-(?<month>\d{2})/);
  
  assertEquals(analysis.captureGroupCount, 2);
  assertEquals(analysis.hasNamedGroups, true);
  assertEquals(analysis.minLength, 7); // 1234-56
});

Deno.test("analyzeRegex - with backreference", () => {
  const analysis = analyzeRegex(/(["'])(.*?)\1/);
  
  assertEquals(analysis.hasBackreferences, true);
  assertEquals(analysis.captureGroupCount, 2);
});

Deno.test("analyzeRegex - with lookahead", () => {
  const analysis = analyzeRegex(/\d+(?=px)/);
  
  assertEquals(analysis.hasLookarounds, true);
});

Deno.test("analyzeRegex - with lookbehind", () => {
  const analysis = analyzeRegex(/(?<=\$)\d+/);
  
  assertEquals(analysis.hasLookarounds, true);
});

Deno.test("analyzeRegex - with flags", () => {
  const analysis = analyzeRegex(/test/gi);
  
  assertEquals(analysis.flags, "gi");
});

Deno.test("regexToStringMinMax - generates valid regex candidates", () => {
  const result = regexToStringMinMax(/^[a-z]+@[a-z]+\.[a-z]+$/, 10, 50, {
    generateCandidates: true,
    candidateCount: 3,
  });
  
  assertExists(result.candidates);
  
  // Test that each candidate regex is valid
  for (const candidate of result.candidates!) {
    const testRegex = new RegExp(candidate.regex);
    assertExists(testRegex);
  }
});

Deno.test("regexToStringMinMax - alternation picks minimum", () => {
  const result = regexToStringMinMax(/(short|verylongalternative)/, 5, 10);
  
  // The minimum should be the shortest alternative
  assertEquals(result.actualMinLength, 5); // "short"
});

Deno.test("regexToStringMinMax - nested quantifiers", () => {
  const result = regexToStringMinMax(/^([a-z]{2}){3}$/, 6, 6, {
    generateCandidates: true,
  });
  
  assertExists(result.candidates);
  // Should generate candidates with exactly 6 characters
  assertEquals(result.candidates![0]!.minLength, 6);
});

Deno.test("estimateMinLength - nested groups", () => {
  const min = estimateMinLength(/^(a(b(c)))$/);
  assertEquals(min, 3); // abc
});

Deno.test("estimateMinLength - character classes", () => {
  const min = estimateMinLength(/^[abc][def][ghi]$/);
  assertEquals(min, 3); // Each class matches one character
});

Deno.test("estimateMaxLength - mixed quantifiers", () => {
  const max = estimateMaxLength(/^[a-z]{2,4}[0-9]{3}$/);
  assertEquals(max, 7); // 4 letters + 3 digits
});
