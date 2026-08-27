/**
 * Swift keywords that can not be used as a declaration name without backticks.
 * Member *access* (`LucideIcon.import`) is fine for all of these, only the
 * declaration needs escaping.
 */
const SWIFT_KEYWORDS = new Set([
  'Any',
  'Protocol',
  'Self',
  'Type',
  'as',
  'associatedtype',
  'associativity',
  'borrowing',
  'break',
  'case',
  'catch',
  'class',
  'consuming',
  'continue',
  'convenience',
  'default',
  'defer',
  'deinit',
  'didSet',
  'do',
  'dynamic',
  'else',
  'enum',
  'extension',
  'fallthrough',
  'false',
  'fileprivate',
  'final',
  'for',
  'func',
  'get',
  'guard',
  'if',
  'import',
  'in',
  'indirect',
  'infix',
  'init',
  'inout',
  'internal',
  'is',
  'lazy',
  'left',
  'let',
  'mutating',
  'nil',
  'none',
  'nonisolated',
  'nonmutating',
  'open',
  'operator',
  'optional',
  'override',
  'postfix',
  'precedence',
  'prefix',
  'private',
  'protocol',
  'public',
  'repeat',
  'required',
  'rethrows',
  'return',
  'right',
  'self',
  'sending',
  'set',
  'some',
  'static',
  'struct',
  'subscript',
  'super',
  'switch',
  'throw',
  'throws',
  'true',
  'try',
  'typealias',
  'unowned',
  'var',
  'weak',
  'where',
  'while',
  'willSet',
]);

/**
 * Converts a kebab-case icon name to a lowerCamelCase Swift identifier.
 *
 * This mirrors `toCamelCase` from `@lucide/shared`, so the Swift names line up
 * with the names the JavaScript packages use: `arrow-up-right` becomes
 * `arrowUpRight`, just like the React component is `ArrowUpRight`.
 */
export function toSwiftIdentifier(iconName: string): string {
  const identifier = iconName
    .split(/[-_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment, index) =>
      index === 0 ? segment : `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`,
    )
    .join('');

  if (identifier.length === 0) {
    throw new Error(`'${iconName}' does not translate to a Swift identifier.`);
  }

  // Swift identifiers can not start with a digit. No icon does today, but a
  // future `1-password` style name shouldn't quietly produce invalid Swift.
  if (/^[0-9]/.test(identifier)) {
    return `_${identifier}`;
  }

  return identifier;
}

/** Wraps an identifier in backticks when it collides with a Swift keyword. */
export function escapeSwiftIdentifier(identifier: string): string {
  return SWIFT_KEYWORDS.has(identifier) ? `\`${identifier}\`` : identifier;
}

export function isSwiftKeyword(identifier: string): boolean {
  return SWIFT_KEYWORDS.has(identifier);
}
