/**
 * Thrown when the generator cannot produce a valid value for a schema node.
 *
 * Carries the node's path and, for a regex-backed string, the pattern, so a
 * caller can report WHICH field failed on WHAT without re-running anything.
 * The message never embeds the rejected value itself: a regex-backed draw can
 * be kilobytes long, and printing it buried the actual cause.
 */
export class MockGenerationError extends Error {
  /** Dot-separated path of the node (`""` at the root). */
  readonly path: string;
  /** Valibot type of the node (`string`, `object`…). */
  readonly schemaType: string;
  /** The pattern of a regex-backed string, as `/source/flags`. */
  readonly pattern: string | undefined;

  constructor(
    message: string,
    details: { path: string; schemaType: string; pattern?: string | undefined },
  ) {
    super(message);
    this.name = "MockGenerationError";
    this.path = details.path;
    this.schemaType = details.schemaType;
    this.pattern = details.pattern;
  }
}
