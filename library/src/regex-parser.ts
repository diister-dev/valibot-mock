// ============================================
// REGEX PARSER USING @eslint-community/regexpp
// ============================================

import {
  parseRegExpLiteral,
  visitRegExpAST,
  type AST,
} from "@eslint-community/regexpp";

// ============================================
// 1. TYPES AND INTERFACES
// ============================================

export interface ParsedRegex {
  ast: AST.Node;
  pattern: AST.Pattern;
  flags: AST.Flags;
  source: string;
}

export interface RegexLengthEstimate {
  min: number;
  max: number | null; // null = infinite
}

export interface RegexTransformResult {
  transformed: string;
  actualMinLength: number;
  actualMaxLength: number | null;
  isExact: boolean;
  candidates?: Array<{ regex: string; minLength: number; maxLength: number | null }> | undefined;
  warning?: string | undefined;
}

export interface RegexStringOptions {
  includeDelimiters?: boolean;
  includeFlags?: boolean;
  flags?: string;
}

export interface MinMaxOptions {
  min: number;
  max: number;
  preferLazy?: boolean;
  generateCandidates?: boolean;
  candidateCount?: number;
}

// ============================================
// 2. PARSER WRAPPER
// ============================================

export function parseRegex(regex: string | RegExp): ParsedRegex {
  let source: string;
  
  if (regex instanceof RegExp) {
    // Convert RegExp to string literal with delimiters
    source = `/${regex.source}/${regex.flags}`;
  } else {
    // If it's already a string, check if it has delimiters
    source = regex.startsWith('/') ? regex : `/${regex}/`;
  }
  
  try {
    const ast = parseRegExpLiteral(source);
    
    return {
      ast,
      pattern: ast.pattern,
      flags: ast.flags,
      source: regex instanceof RegExp ? regex.source : (regex.startsWith('/') ? regex.slice(1, regex.lastIndexOf('/')) : regex),
    };
  } catch (error) {
    throw new Error(`Failed to parse regex: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// 3. LENGTH ESTIMATORS
// ============================================

class LengthEstimatorVisitor {
  estimate(node: AST.Node): RegexLengthEstimate {
    const result = this.visitNode(node);
    return {
      min: result.min,
      max: result.max,
    };
  }

  private visitNode(node: AST.Node): { min: number; max: number | null } {
    switch (node.type) {
      case "RegExpLiteral":
        return this.visitNode(node.pattern);
      
      case "Pattern":
        return this.visitAlternatives(node.alternatives);
      
      case "Alternative":
        return this.visitSequence(node.elements);
      
      case "Character":
      case "CharacterSet":
      case "CharacterClass":
        return { min: 1, max: 1 };
      
      case "Quantifier":
        return this.visitQuantifier(node);
      
      case "Group":
      case "CapturingGroup":
        if (node.alternatives.length > 0) {
          return this.visitAlternatives(node.alternatives);
        }
        return { min: 0, max: 0 };
      
      case "Assertion":
        // Assertions don't consume characters
        return { min: 0, max: 0 };
      
      case "Backreference":
        // Impossible to determine precisely
        return { min: 0, max: null };
      
      default:
        return { min: 0, max: 0 };
    }
  }

  private visitAlternatives(alternatives: AST.Alternative[]): { min: number; max: number | null } {
    if (alternatives.length === 0) {
      return { min: 0, max: 0 };
    }

    let overallMin = Infinity;
    let overallMax: number | null = 0;

    for (const alt of alternatives) {
      const result = this.visitSequence(alt.elements);
      overallMin = Math.min(overallMin, result.min);
      
      if (result.max === null || overallMax === null) {
        overallMax = null;
      } else {
        overallMax = Math.max(overallMax, result.max);
      }
    }

    return {
      min: overallMin === Infinity ? 0 : overallMin,
      max: overallMax,
    };
  }

  private visitSequence(elements: AST.Element[]): { min: number; max: number | null } {
    let totalMin = 0;
    let totalMax: number | null = 0;

    for (const elem of elements) {
      const result = this.visitNode(elem);
      totalMin += result.min;
      
      // If an element has max=null (infinite), the total max becomes null
      if (result.max === null) {
        totalMax = null;
      } else if (totalMax !== null) {
        // Only add if totalMax is not already null
        totalMax += result.max;
      }
    }

    return { min: totalMin, max: totalMax };
  }

  private visitQuantifier(node: AST.Quantifier): { min: number; max: number | null } {
    const elementResult = this.visitNode(node.element);
    
    const min = node.min * elementResult.min;
    
    if (node.max === Infinity) {
      return { min, max: null };
    }
    
    if (elementResult.max === null) {
      return { min, max: null };
    }
    
    const max = node.max * elementResult.max;
    
    return { min, max };
  }
}

export function estimateMinLength(regex: string | RegExp): number {
  const parsed = parseRegex(regex);
  const estimator = new LengthEstimatorVisitor();
  return estimator.estimate(parsed.pattern).min;
}

export function estimateMaxLength(regex: string | RegExp): number | null {
  const parsed = parseRegex(regex);
  const estimator = new LengthEstimatorVisitor();
  return estimator.estimate(parsed.pattern).max;
}

// ============================================
// 4. MIN/MAX TRANSFORMER
// ============================================

class MinMaxTransformer {
  constructor(
    private minTarget: number,
    private maxTarget: number,
    private options: { preferLazy?: boolean } = {}
  ) {}

  transform(pattern: string, flags?: string): string {
    // For this simplified version, we use a reconstruction approach
    // based on modifying quantifiers
    
    // Parse the regex
    const parsed = parseRegex(flags ? `/${pattern}/${flags}` : pattern);
    
    // Rebuild by modifying quantifiers
    const result = this.transformPattern(parsed.pattern);
    
    return result;
  }

  private transformPattern(pattern: AST.Pattern): string {
    return this.transformAlternatives(pattern.alternatives);
  }

  private transformAlternatives(alternatives: AST.Alternative[]): string {
    if (alternatives.length === 0) return "";
    if (alternatives.length === 1) {
      const alt = alternatives[0];
      return alt ? this.transformAlternative(alt) : "";
    }
    
    return alternatives.map(alt => this.transformAlternative(alt)).join("|");
  }

  private transformAlternative(alternative: AST.Alternative): string {
    return alternative.elements.map((elem: AST.Element) => this.transformElement(elem)).join("");
  }

  private transformElement(element: AST.Element): string {
    switch (element.type) {
      case "Character":
        return this.escapeChar(element.value);
      
      case "CharacterClass":
        return this.transformCharacterClass(element);
      
      case "CharacterSet":
        return this.transformCharacterSet(element);
      
      case "Quantifier":
        return this.transformQuantifier(element);
      
      case "CapturingGroup":
        return this.transformCapturingGroup(element);
      
      case "Group":
        return this.transformGroup(element);
      
      case "Assertion":
        return this.transformAssertion(element);
      
      case "Backreference":
        return this.transformBackreference(element);
      
      default:
        return "";
    }
  }

  private escapeChar(value: number): string {
    const char = String.fromCodePoint(value);
    
    // Escape special characters
    if ("\\^$.*+?()[]{}|".includes(char)) {
      return "\\" + char;
    }
    
    // Control characters
    if (value === 0x0A) return "\\n";
    if (value === 0x0D) return "\\r";
    if (value === 0x09) return "\\t";
    
    return char;
  }

  private transformCharacterClass(node: AST.CharacterClass): string {
    let result = "[";
    if (node.negate) result += "^";
    
    for (const elem of node.elements) {
      if (elem.type === "Character") {
        const char = String.fromCodePoint(elem.value);
        // Escape special characters in classes
        if (char === "]" || char === "\\") {
          result += "\\" + char;
        } else if (char === "^" && result === "[") {
          // Escape ^ only if at the beginning
          result += "\\^";
        } else if (char === "-" && result.length > 1 && result[result.length - 1] !== "[") {
          // Escape - if not at the beginning or end
          result += "\\-";
        } else {
          result += char;
        }
      } else if (elem.type === "CharacterClassRange") {
        const fromChar = String.fromCodePoint(elem.min.value);
        const toChar = String.fromCodePoint(elem.max.value);
        result += fromChar + "-" + toChar;
      } else if (elem.type === "CharacterSet") {
        result += this.transformCharacterSet(elem);
      }
    }
    
    result += "]";
    return result;
  }

  private transformCharacterSet(node: AST.CharacterSet): string {
    if (node.kind === "any") return ".";
    if (node.kind === "digit") return "\\d";
    if (node.kind === "word") return "\\w";
    if (node.kind === "space") return "\\s";
    return "";
  }

  private transformQuantifier(node: AST.Quantifier): string {
    const element = this.transformElement(node.element);
    
    // Calculate new limits based on budget
    let min = node.min;
    let max = node.max;
    
    // Limit max if infinite
    if (max === Infinity) {
      max = this.maxTarget;
    } else {
      max = Math.min(max, this.maxTarget);
    }
    
    // Adjust min
    min = Math.max(0, Math.min(min, this.minTarget));
    
    const lazy = this.options.preferLazy || node.greedy === false ? "?" : "";
    
    // Build the quantifier
    if (min === 0 && max === 1) {
      return `${element}?${lazy}`;
    } else if (min === 0 && max === Infinity) {
      return `${element}*${lazy}`;
    } else if (min === 1 && max === Infinity) {
      return `${element}+${lazy}`;
    } else if (min === max) {
      return `${element}{${min}}`;
    } else if (max === Infinity) {
      return `${element}{${min},}${lazy}`;
    } else {
      return `${element}{${min},${max}}${lazy}`;
    }
  }

  private transformCapturingGroup(node: AST.CapturingGroup): string {
    const content = this.transformAlternatives(node.alternatives);
    
    if (node.name) {
      return `(?<${node.name}>${content})`;
    }
    
    return `(${content})`;
  }

  private transformGroup(node: AST.Group): string {
    const content = this.transformAlternatives(node.alternatives);
    return `(?:${content})`;
  }

  private transformAssertion(node: AST.Assertion): string {
    if (node.kind === "start") return "^";
    if (node.kind === "end") return "$";
    if (node.kind === "word") return "\\b";
    
    if (node.kind === "lookahead") {
      const content = this.transformAlternatives(node.alternatives);
      return node.negate ? `(?!${content})` : `(?=${content})`;
    }
    
    if (node.kind === "lookbehind") {
      const content = this.transformAlternatives(node.alternatives);
      return node.negate ? `(?<!${content})` : `(?<=${content})`;
    }
    
    return "";
  }

  private transformBackreference(node: AST.Backreference): string {
    if (typeof node.ref === "number") {
      return `\\${node.ref}`;
    } else {
      return `\\k<${node.ref}>`;
    }
  }
}

// ============================================
// 5. REGEX CANDIDATE GENERATOR
// ============================================

class RegexCandidateGenerator {
  private parsed: ParsedRegex;

  constructor(regex: RegExp | string) {
    try {
      this.parsed = parseRegex(regex);
    } catch {
      // If parsing fails, create a default version
      this.parsed = {
        ast: {} as AST.Node,
        pattern: {} as AST.Pattern,
        flags: { raw: "" } as AST.Flags,
        source: typeof regex === "string" ? regex : regex.source,
      };
    }
  }

  /**
   * Generates different variants of the regex with adjusted quantifiers
   * to produce strings with length between minLength and maxLength
   */
  generate(
    minLength: number,
    maxLength: number,
    count: number = 5
  ): Array<{ regex: string; minLength: number; maxLength: number | null }> {
    const candidates: Array<{ regex: string; minLength: number; maxLength: number | null }> = [];
    
    // Analyze quantifiers in the regex
    const quantifiers = this.findQuantifiers(this.parsed.pattern);
    
    if (quantifiers.length === 0) {
      // No quantifiers, return the regex as is
      const estimator = new LengthEstimatorVisitor();
      const estimate = estimator.estimate(this.parsed.pattern);
      return [{
        regex: this.parsed.source,
        minLength: estimate.min,
        maxLength: estimate.max,
      }];
    }
    
    // Generate different quantifier configurations
    const configurations = this.generateQuantifierConfigurations(
      quantifiers,
      minLength,
      maxLength,
      count
    );
    
    for (const config of configurations) {
      const transformedRegex = this.applyQuantifierConfiguration(config);
      const estimator = new LengthEstimatorVisitor();
      
      try {
        const parsed = parseRegex(transformedRegex);
        const estimate = estimator.estimate(parsed.pattern);
        
        candidates.push({
          regex: transformedRegex,
          minLength: estimate.min,
          maxLength: estimate.max,
        });
      } catch {
        // Ignore invalid configurations
        continue;
      }
    }
    
    return candidates.slice(0, count);
  }

  private findQuantifiers(pattern: AST.Pattern): AST.Quantifier[] {
    const quantifiers: AST.Quantifier[] = [];

    const visitor = (node: AST.Node) => {
      switch (node.type) {
        case "Quantifier":
          quantifiers.push(node);
          visitor(node.element);
          break;
        case "Pattern":
          node.alternatives.forEach(alt => alt.elements.forEach(visitor));
          break;
        case "Alternative":
          node.elements.forEach(visitor);
          break;
        case "Group":
        case "CapturingGroup":
          node.alternatives.forEach(alt => alt.elements.forEach(visitor));
          break;
      }
    };

    visitor(pattern);
    return quantifiers;
  }

  private generateQuantifierConfigurations(
    quantifiers: AST.Quantifier[],
    minLength: number,
    maxLength: number,
    count: number
  ): Array<Map<AST.Quantifier, { min: number; max: number }>> {
    const configurations: Array<Map<AST.Quantifier, { min: number; max: number }>> = [];
    const estimator = new LengthEstimatorVisitor();
    
    // Identify quantifiers that can grow
    const growableQuantifiers = quantifiers.filter(q => 
      q.min < (q.max === Infinity ? 1000 : q.max) || q.min === 0
    );
    
    if (growableQuantifiers.length === 0) {
      // No quantifier can change
      const config = new Map<AST.Quantifier, { min: number; max: number }>();
      for (const q of quantifiers) {
        config.set(q, { min: q.min, max: q.max === Infinity ? q.min : q.max });
      }
      configurations.push(config);
      return configurations;
    }
    
    // Calculate repetition values to try
    // For simple ranges (like [14, 14]), we want to try exactly 14
    // For wide ranges (like [5, 254]), we want to try several values
    const range = maxLength - minLength;
    
    let targetValues: number[];
    if (range === 0) {
      // Exact length requested
      targetValues = [minLength];
    } else if (range <= 20) {
      // Small range: try min, max, and a few intermediate values
      targetValues = [
        minLength,
        Math.floor((minLength + maxLength) / 2),
        maxLength,
      ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
    } else {
      // Large range: try min, max, and several intermediate values
      targetValues = [
        minLength,
        Math.floor(minLength + range * 0.25),
        Math.floor(minLength + range * 0.5),
        Math.floor(minLength + range * 0.75),
        maxLength,
      ].filter((v, i, arr) => arr.indexOf(v) === i);
    }
    
    for (const targetLength of targetValues) {
      if (configurations.length >= count) break;
      
      const config = new Map<AST.Quantifier, { min: number; max: number }>();
      
      // Calculate how many repetitions per quantifier to reach targetLength
      for (const q of quantifiers) {
        const elemLength = estimator.estimate(q.element).min || 1;
        
        if (growableQuantifiers.includes(q)) {
          // Distribute targetLength among all "growable" quantifiers
          const repsNeeded = Math.floor(targetLength / growableQuantifiers.length / elemLength);
          const finalValue = Math.max(q.min, Math.min(
            repsNeeded,
            q.max === Infinity ? targetLength : q.max
          ));
          
          config.set(q, { min: finalValue, max: finalValue });
        } else {
          config.set(q, { min: q.min, max: q.max === Infinity ? q.min : q.max });
        }
      }
      
      // Check if this configuration produces a length in the range
      try {
        const testRegex = this.applyQuantifierConfiguration(config);
        const testParsed = parseRegex(testRegex);
        const testEstimate = estimator.estimate(testParsed.pattern);
        
        // Add if within requested range
        if (testEstimate.min >= minLength && testEstimate.min <= maxLength) {
          configurations.push(config);
        }
      } catch {
        // Ignore invalid configurations
        continue;
      }
    }
    
    // If still no valid configs, try to force with exact targetLength
    if (configurations.length === 0) {
      const config = new Map<AST.Quantifier, { min: number; max: number }>();
      for (const q of quantifiers) {
        const elemLength = estimator.estimate(q.element).min || 1;
        const repsNeeded = Math.floor(minLength / elemLength);
        const finalValue = Math.max(q.min, Math.min(
          repsNeeded,
          q.max === Infinity ? minLength : q.max
        ));
        config.set(q, { min: finalValue, max: finalValue });
      }
      configurations.push(config);
    }
    
    return configurations.slice(0, count);
  }

  private applyQuantifierConfiguration(
    config: Map<AST.Quantifier, { min: number; max: number }>
  ): string {
    // Create a transformer with custom quantifiers
    const transformer = new ConfigurableTransformer(config);
    return transformer.transform(this.parsed.pattern);
  }
}

/**
 * Transformer that applies a specific quantifier configuration
 */
class ConfigurableTransformer {
  constructor(
    private quantifierConfig: Map<AST.Quantifier, { min: number; max: number }>
  ) {}

  transform(pattern: AST.Pattern): string {
    return this.transformAlternatives(pattern.alternatives);
  }

  private transformAlternatives(alternatives: AST.Alternative[]): string {
    if (alternatives.length === 0) return "";
    if (alternatives.length === 1) {
      const alt = alternatives[0];
      return alt ? this.transformAlternative(alt) : "";
    }
    
    return alternatives.map(alt => this.transformAlternative(alt)).join("|");
  }

  private transformAlternative(alternative: AST.Alternative): string {
    return alternative.elements.map((elem: AST.Element) => this.transformElement(elem)).join("");
  }

  private transformElement(element: AST.Element): string {
    switch (element.type) {
      case "Character":
        return this.escapeChar(element.value);
      
      case "CharacterClass":
        return this.transformCharacterClass(element);
      
      case "CharacterSet":
        return this.transformCharacterSet(element);
      
      case "Quantifier":
        return this.transformQuantifier(element);
      
      case "CapturingGroup":
        return this.transformCapturingGroup(element);
      
      case "Group":
        return this.transformGroup(element);
      
      case "Assertion":
        return this.transformAssertion(element);
      
      case "Backreference":
        return this.transformBackreference(element);
      
      default:
        return "";
    }
  }

  private escapeChar(value: number): string {
    const char = String.fromCodePoint(value);
    if ("\\^$.*+?()[]{}|".includes(char)) return "\\" + char;
    if (value === 0x0A) return "\\n";
    if (value === 0x0D) return "\\r";
    if (value === 0x09) return "\\t";
    return char;
  }

  private transformCharacterClass(node: AST.CharacterClass): string {
    let result = "[";
    if (node.negate) result += "^";
    
    for (const elem of node.elements) {
      if (elem.type === "Character") {
        const char = String.fromCodePoint(elem.value);
        if (char === "]" || char === "\\") {
          result += "\\" + char;
        } else if (char === "^" && result === "[") {
          result += "\\^";
        } else if (char === "-" && result.length > 1 && result[result.length - 1] !== "[") {
          result += "\\-";
        } else {
          result += char;
        }
      } else if (elem.type === "CharacterClassRange") {
        const fromChar = String.fromCodePoint(elem.min.value);
        const toChar = String.fromCodePoint(elem.max.value);
        result += fromChar + "-" + toChar;
      } else if (elem.type === "CharacterSet") {
        result += this.transformCharacterSet(elem);
      }
    }
    
    result += "]";
    return result;
  }

  private transformCharacterSet(node: AST.CharacterSet): string {
    if (node.kind === "any") return ".";
    if (node.kind === "digit") return "\\d";
    if (node.kind === "word") return "\\w";
    if (node.kind === "space") return "\\s";
    return "";
  }

  private transformQuantifier(node: AST.Quantifier): string {
    const element = this.transformElement(node.element);
    
    // Use custom configuration if available
    const config = this.quantifierConfig.get(node);
    const min = config ? config.min : node.min;
    const max = config ? config.max : node.max;
    
    const lazy = node.greedy === false ? "?" : "";
    
    // Build the quantifier
    if (min === 0 && max === 1) {
      return `${element}?${lazy}`;
    } else if (min === 0 && max === Infinity) {
      return `${element}*${lazy}`;
    } else if (min === 1 && max === Infinity) {
      return `${element}+${lazy}`;
    } else if (min === max) {
      return `${element}{${min}}`;
    } else if (max === Infinity) {
      return `${element}{${min},}${lazy}`;
    } else {
      return `${element}{${min},${max}}${lazy}`;
    }
  }

  private transformCapturingGroup(node: AST.CapturingGroup): string {
    const content = this.transformAlternatives(node.alternatives);
    if (node.name) {
      return `(?<${node.name}>${content})`;
    }
    return `(${content})`;
  }

  private transformGroup(node: AST.Group): string {
    const content = this.transformAlternatives(node.alternatives);
    return `(?:${content})`;
  }

  private transformAssertion(node: AST.Assertion): string {
    if (node.kind === "start") return "^";
    if (node.kind === "end") return "$";
    if (node.kind === "word") return "\\b";
    
    if (node.kind === "lookahead") {
      const content = this.transformAlternatives(node.alternatives);
      return node.negate ? `(?!${content})` : `(?=${content})`;
    }
    
    if (node.kind === "lookbehind") {
      const content = this.transformAlternatives(node.alternatives);
      return node.negate ? `(?<!${content})` : `(?<=${content})`;
    }
    
    return "";
  }

  private transformBackreference(node: AST.Backreference): string {
    if (typeof node.ref === "number") {
      return `\\${node.ref}`;
    } else {
      return `\\k<${node.ref}>`;
    }
  }
}

// ============================================
// 6. PUBLIC API
// ============================================

export function regexToString(
  parsed: ParsedRegex,
  options: RegexStringOptions = {}
): string {
  const transformer = new MinMaxTransformer(0, Infinity);
  let result = transformer.transform(parsed.source, parsed.flags.raw);
  
  if (options.includeDelimiters) {
    const flags = options.flags || parsed.flags.raw || "";
    result = `/${result}/${options.includeFlags ? flags : ""}`;
  }
  
  return result;
}

export function regexToStringMinMax(
  regex: string | RegExp,
  minLength: number,
  maxLength: number,
  options: Partial<Omit<MinMaxOptions, 'min' | 'max'>> = {}
): RegexTransformResult {
  const parsed = parseRegex(regex);
  
  // Analyze current lengths
  const estimator = new LengthEstimatorVisitor();
  const currentEstimate = estimator.estimate(parsed.pattern);
  
  // Check feasibility
  if (currentEstimate.min > maxLength) {
    return {
      transformed: regex.toString(),
      actualMinLength: currentEstimate.min,
      actualMaxLength: currentEstimate.max,
      isExact: false,
      warning: `Cannot meet maxLength=${maxLength}. Structural minimum is ${currentEstimate.min}`,
      candidates: options.generateCandidates
        ? new RegexCandidateGenerator(regex).generate(
            currentEstimate.min,
            currentEstimate.min + 10,
            options.candidateCount || 5
          )
        : undefined,
    };
  }

  // Transform
  const transformerOptions: { preferLazy?: boolean } = {};
  if (options.preferLazy !== undefined) {
    transformerOptions.preferLazy = options.preferLazy;
  }
  const transformer = new MinMaxTransformer(minLength, maxLength, transformerOptions);
  
  const source = regex instanceof RegExp ? regex.source : regex;
  const flags = regex instanceof RegExp ? regex.flags : undefined;
  
  const transformedPattern = transformer.transform(source, flags);
  
  // Recalculate limits - avoid re-parsing if it causes errors
  let finalEstimate: RegexLengthEstimate;
  try {
    const transformedRegex = flags ? `/${transformedPattern}/${flags}` : `/${transformedPattern}/`;
    finalEstimate = estimator.estimate(parseRegex(transformedRegex).pattern);
  } catch {
    // If re-parsing fails, use a basic estimation
    finalEstimate = { min: minLength, max: maxLength };
  }
  
  // Generate candidates if requested
  const candidates = options.generateCandidates
    ? new RegexCandidateGenerator(regex).generate(
        minLength,
        maxLength,
        options.candidateCount || 5
      )
    : undefined;

  return {
    transformed: transformedPattern,
    actualMinLength: finalEstimate.min,
    actualMaxLength: finalEstimate.max,
    isExact: finalEstimate.min >= minLength && 
             (finalEstimate.max === null || finalEstimate.max <= maxLength),
    candidates,
    warning: finalEstimate.min > maxLength
      ? `Constraints are too strict. Actual min: ${finalEstimate.min}`
      : undefined,
  };
}

// ============================================
// 7. ANALYSIS UTILITIES
// ============================================

export function analyzeRegex(regex: string | RegExp): {
  hasBackreferences: boolean;
  hasLookarounds: boolean;
  hasNamedGroups: boolean;
  captureGroupCount: number;
  minLength: number;
  maxLength: number | null;
  flags: string;
} {
  const parsed = parseRegex(regex);
  
  let hasBackreferences = false;
  let hasLookarounds = false;
  let hasNamedGroups = false;
  let captureGroupCount = 0;

  visitRegExpAST(parsed.ast, {
    onBackreferenceEnter() {
      hasBackreferences = true;
    },
    onAssertionEnter(node: AST.Assertion) {
      if (node.kind === "lookahead" || node.kind === "lookbehind") {
        hasLookarounds = true;
      }
    },
    onCapturingGroupEnter(node: AST.CapturingGroup) {
      captureGroupCount++;
      if (node.name) {
        hasNamedGroups = true;
      }
    },
  });

  const estimator = new LengthEstimatorVisitor();
  const estimate = estimator.estimate(parsed.pattern);

  return {
    hasBackreferences,
    hasLookarounds,
    hasNamedGroups,
    captureGroupCount,
    minLength: estimate.min,
    maxLength: estimate.max,
    flags: parsed.flags.raw,
  };
}