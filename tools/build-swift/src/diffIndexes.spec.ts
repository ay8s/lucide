import { describe, expect, it } from 'vitest';

import { diffIndexes, formatDiff, type IconIndex } from './diffIndexes.ts';

const from: IconIndex = {
  lucideVersion: '1.27.0',
  icons: { smile: 57100, house: 57101, twitter: 57102, clock: 57103 },
  aliases: { home: 'house' },
  removed: {},
};

const to: IconIndex = {
  lucideVersion: '1.34.0',
  icons: { 'face-slightly-smiling': 57100, house: 57101, clock: 57103, galaxy: 57200 },
  aliases: { smile: 'face-slightly-smiling', home: 'house', 'alarm-clock': 'clock' },
  removed: { twitter: 57102 },
};

describe('diffIndexes', () => {
  const diff = diffIndexes(from, to);

  it('reports an icon that kept its glyph under a new name as a rename', () => {
    expect(diff.renamed).toEqual([
      {
        from: 'smile',
        to: 'face-slightly-smiling',
        fromIdentifier: 'smile',
        toIdentifier: 'faceSlightlySmiling',
        codePoint: 57100,
      },
    ]);
  });

  it('does not also report the new name of a rename as an added icon', () => {
    expect(diff.added).toEqual([{ name: 'galaxy', identifier: 'galaxy', codePoint: 57200 }]);
  });

  it('reports an icon that lost its glyph as removed', () => {
    expect(diff.removed).toEqual([{ name: 'twitter', identifier: 'twitter', codePoint: 57102 }]);
  });

  it('reports alternative names that appeared, leaving out the ones that are renames', () => {
    expect(diff.aliasesAdded).toEqual([{ name: 'alarm-clock', icon: 'clock' }]);
  });

  it('reports alternative names that stopped resolving', () => {
    expect(
      diffIndexes(from, { ...to, aliases: { smile: 'face-slightly-smiling' } }).aliasesRemoved,
    ).toEqual(['home']);
  });

  it('counts the icons that did not change', () => {
    expect(diff.summary).toEqual({
      added: 1,
      removed: 1,
      renamed: 1,
      aliasesAdded: 1,
      aliasesRemoved: 0,
      movedCodePoints: 0,
      unchanged: 2,
    });
  });

  it('flags a code point that moved, which Lucide never does', () => {
    const moved = diffIndexes(from, { ...to, icons: { ...to.icons, house: 57999 } });

    expect(moved.movedCodePoints).toEqual([{ name: 'house', from: 57101, to: 57999 }]);
  });

  it('carries the versions and counts of both sides', () => {
    expect(diff.from).toEqual({ lucideVersion: '1.27.0', iconCount: 4, aliasCount: 1 });
    expect(diff.to).toEqual({ lucideVersion: '1.34.0', iconCount: 4, aliasCount: 3 });
  });
});

describe('formatDiff', () => {
  it('leads with the versions and spells out what a rename means for Swift', () => {
    const summary = formatDiff(diffIndexes(from, to));

    expect(summary).toContain('Lucide 1.27.0 → 1.34.0');
    expect(summary).toContain('smile → face-slightly-smiling  (.smile → .faceSlightlySmiling)');
    expect(summary).toContain('twitter  (.twitter)');
  });

  it('says so when nothing changed', () => {
    expect(formatDiff(diffIndexes(from, from))).toContain(
      'no icons were added, removed or renamed',
    );
  });
});
