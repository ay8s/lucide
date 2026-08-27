import { describe, expect, it } from 'vitest';

import { escapeSwiftIdentifier, isSwiftKeyword, toSwiftIdentifier } from './swiftIdentifier.ts';

describe('toSwiftIdentifier', () => {
  it('camel cases kebab case icon names', () => {
    expect(toSwiftIdentifier('house')).toBe('house');
    expect(toSwiftIdentifier('circle-check')).toBe('circleCheck');
    expect(toSwiftIdentifier('arrow-up-right')).toBe('arrowUpRight');
    expect(toSwiftIdentifier('a-arrow-down')).toBe('aArrowDown');
  });

  it('keeps digits attached to the segment before them', () => {
    expect(toSwiftIdentifier('arrow-down-0-1')).toBe('arrowDown01');
    expect(toSwiftIdentifier('trash-2')).toBe('trash2');
  });

  it('prefixes names that would start with a digit', () => {
    expect(toSwiftIdentifier('1-password')).toBe('_1Password');
  });

  it('rejects names that hold no characters', () => {
    expect(() => toSwiftIdentifier('--')).toThrow();
  });
});

describe('escapeSwiftIdentifier', () => {
  it('escapes Swift keywords', () => {
    expect(escapeSwiftIdentifier('repeat')).toBe('`repeat`');
    expect(escapeSwiftIdentifier('import')).toBe('`import`');
    expect(escapeSwiftIdentifier('subscript')).toBe('`subscript`');
  });

  it('leaves everything else alone', () => {
    expect(escapeSwiftIdentifier('circleCheck')).toBe('circleCheck');
    expect(isSwiftKeyword('circleCheck')).toBe(false);
  });
});
