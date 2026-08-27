import { describe, expect, it } from 'vitest';

import { collectIcons } from './collectIcons.ts';
import {
  generateAliasesFile,
  generateIconsFile,
  generateIndexJson,
  generateMetadataFile,
  generateRemovedFile,
  generateTestConstantsFile,
  type GenerationContext,
} from './generateSwift.ts';

const context: GenerationContext = {
  lucideVersion: '1.34.0',
  moduleName: 'LucideIcons',
  familyName: 'lucide',
  postScriptName: 'lucide',
  fontFileName: 'lucide',
};

const iconSet = collectIcons({
  codePoints: {
    'alarm-clock-check': 57402,
    'alarm-check': 57300,
    repeat: 57404,
    twitter: 57405,
  },
  coveredCodePoints: new Set([57300, 57402, 57404]),
  metadata: {
    'alarm-clock-check': {
      categories: ['time'],
      aliases: [{ name: 'alarm-check', deprecated: true, deprecationReason: 'alias.name' }],
    },
    repeat: { categories: ['arrows'] },
  },
});

describe('generateIconsFile', () => {
  const contents = generateIconsFile(iconSet, context);

  it('declares a constant per icon, with its code point in hex', () => {
    expect(contents).toContain(
      '    public static let alarmClockCheck = LucideIcon("alarm-clock-check", codePoint: 0xE03A)',
    );
  });

  it('escapes names that are Swift keywords', () => {
    expect(contents).toContain('    public static let `repeat` = LucideIcon("repeat"');
  });

  it('documents the alternative names of an icon', () => {
    expect(contents).toContain('/// Also known as `alarm-check`.');
  });

  it('says where it came from', () => {
    expect(contents).toContain('// Source: lucide-static@1.34.0');
    expect(contents).toContain('do not edit it by hand');
  });

  it('leaves out names without a glyph', () => {
    expect(contents).not.toContain('twitter');
  });
});

describe('generateAliasesFile', () => {
  const contents = generateAliasesFile(iconSet, context);

  it('points an alias at the icon it belongs to', () => {
    expect(contents).toContain(
      '    public static let alarmCheck = LucideIcon("alarm-clock-check", codePoint: 0xE03A)',
    );
  });

  it('marks a deprecated alias as renamed, so the compiler offers a fix-it', () => {
    expect(contents).toContain('@available(*, deprecated, renamed: "LucideIcon.alarmClockCheck"');
  });
});

describe('generateRemovedFile', () => {
  const contents = generateRemovedFile(iconSet, context);

  it('keeps a removed name compiling, with a deprecation that explains itself', () => {
    expect(contents).toContain('    public static let twitter = LucideIcon("twitter"');
    expect(contents).toContain("@available(*, deprecated, message: \"'twitter' was removed");
  });
});

describe('generateMetadataFile', () => {
  it('records the font and the release it was generated from', () => {
    const contents = generateMetadataFile(iconSet, context);

    expect(contents).toContain('public static let lucideVersion = "1.34.0"');
    expect(contents).toContain('public static let postScriptName = "lucide"');
    expect(contents).toContain('public static let iconCount = 2');
    expect(contents).toContain('public static let aliasCount = 1');
  });
});

describe('generateIndexJson', () => {
  it('maps icons to code points, aliases to icons and removals to code points', () => {
    expect(JSON.parse(generateIndexJson(iconSet, context))).toEqual({
      lucideVersion: '1.34.0',
      fontFamilyName: 'lucide',
      fontPostScriptName: 'lucide',
      icons: { 'alarm-clock-check': 57402, repeat: 57404 },
      aliases: { 'alarm-check': 'alarm-clock-check' },
      removed: { twitter: 57405 },
    });
  });
});

describe('generateTestConstantsFile', () => {
  const contents = generateTestConstantsFile(iconSet, context);

  it('lists every constant next to the name it was generated for', () => {
    expect(contents).toContain('("alarm-clock-check", .alarmClockCheck),');
    expect(contents).toContain('("repeat", .`repeat`),');
  });

  it('imports the module it was generated for', () => {
    expect(generateTestConstantsFile(iconSet, { ...context, moduleName: 'LucideSwift' })).toContain(
      'import LucideSwift',
    );
  });

  it('lists the aliases and the removed names for the tests to check', () => {
    expect(contents).toContain('("alarm-check", "alarm-clock-check"),');
    expect(contents).toContain('let generatedRemovedNames: [String] = [\n    "twitter",\n]');
  });
});
