import { describe, expect, it } from 'vitest';

import { collectIcons, type IconMetadata } from './collectIcons.ts';

const metadata: Record<string, IconMetadata> = {
  'alarm-clock-check': {
    categories: ['time'],
    aliases: [{ name: 'alarm-check', deprecated: true, deprecationReason: 'alias.name' }],
  },
  house: {
    categories: ['buildings'],
    aliases: [{ name: 'home' }],
  },
  galaxy: { categories: ['shapes'] },
};

const codePoints = {
  'alarm-clock-check': 57402,
  'alarm-check': 57300,
  house: 57403,
  home: 57403,
  twitter: 57404,
};

const coveredCodePoints = new Set([57300, 57402, 57403]);

describe('collectIcons', () => {
  it('generates the canonical names that have a glyph', () => {
    const { icons } = collectIcons({ codePoints, coveredCodePoints, metadata });

    expect(icons).toEqual([
      {
        name: 'alarm-clock-check',
        identifier: 'alarmClockCheck',
        codePoint: 57402,
        categories: ['time'],
        aliasNames: ['alarm-check'],
        deprecated: false,
      },
      {
        name: 'house',
        identifier: 'house',
        codePoint: 57403,
        categories: ['buildings'],
        aliasNames: ['home'],
        deprecated: false,
      },
    ]);
  });

  it('resolves an alias to the code point of its icon, ignoring its legacy one', () => {
    const { aliases } = collectIcons({ codePoints, coveredCodePoints, metadata });

    expect(aliases[0]).toMatchObject({ name: 'alarm-check', codePoint: 57402 });
    expect(codePoints['alarm-check']).toBe(57300);
  });

  it('keeps aliases and marks the deprecated ones', () => {
    const { aliases } = collectIcons({ codePoints, coveredCodePoints, metadata });

    expect(aliases).toEqual([
      {
        name: 'alarm-check',
        identifier: 'alarmCheck',
        codePoint: 57402,
        iconName: 'alarm-clock-check',
        iconIdentifier: 'alarmClockCheck',
        deprecated: true,
      },
      {
        name: 'home',
        identifier: 'home',
        codePoint: 57403,
        iconName: 'house',
        iconIdentifier: 'house',
        deprecated: false,
      },
    ]);
  });

  it('reports names that kept their code point but lost their glyph', () => {
    const { removed } = collectIcons({ codePoints, coveredCodePoints, metadata });

    expect(removed).toEqual([{ name: 'twitter', identifier: 'twitter', codePoint: 57404 }]);
  });

  it('reports icons that no released font has a code point for', () => {
    const { unreleased } = collectIcons({ codePoints, coveredCodePoints, metadata });

    expect(unreleased).toEqual(['galaxy']);
  });

  it('skips an alias that camel cases to the name of its own icon', () => {
    const { icons, aliases, warnings } = collectIcons({
      codePoints: { 'arrow-down-0-1': 57500, 'arrow-down-01': 57501 },
      coveredCodePoints: new Set([57500, 57501]),
      metadata: {
        'arrow-down-0-1': { aliases: [{ name: 'arrow-down-01', deprecated: true }] },
      },
    });

    expect(icons.map((icon) => icon.identifier)).toEqual(['arrowDown01']);
    expect(aliases).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Alias 'arrow-down-01'");
  });

  it('falls back to the font when there is no metadata to read', () => {
    const { icons, aliases } = collectIcons({
      codePoints,
      coveredCodePoints,
      metadata: {},
    });

    expect(icons.map((icon) => icon.name)).toEqual([
      'alarm-check',
      'alarm-clock-check',
      'home',
      'house',
    ]);
    expect(aliases).toEqual([]);
  });

  it('leaves out a canonical name whose glyph is gone', () => {
    const { icons, warnings } = collectIcons({
      codePoints: { house: 57403 },
      coveredCodePoints: new Set(),
      metadata: { house: {} },
    });

    expect(icons).toEqual([]);
    expect(warnings[0]).toContain('no glyph');
  });
});
