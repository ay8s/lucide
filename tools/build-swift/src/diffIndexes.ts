import { toSwiftIdentifier } from './swiftIdentifier.ts';

/** The shape of the `lucide-icons.json` that ships with the package. */
export interface IconIndex {
  lucideVersion: string;
  fontFamilyName?: string;
  fontPostScriptName?: string;
  icons: Record<string, number>;
  aliases: Record<string, string>;
  removed: Record<string, number>;
}

export interface RenamedIcon {
  from: string;
  to: string;
  fromIdentifier: string;
  toIdentifier: string;
  codePoint: number;
}

export interface RemovedIcon {
  name: string;
  identifier: string;
  codePoint: number;
}

export interface AddedIcon {
  name: string;
  identifier: string;
  codePoint: number;
}

export interface MovedCodePoint {
  name: string;
  from: number;
  to: number;
}

export interface IndexDiff {
  from: { lucideVersion: string; iconCount: number; aliasCount: number };
  to: { lucideVersion: string; iconCount: number; aliasCount: number };
  /** Icons that did not exist before. */
  added: AddedIcon[];
  /**
   * Icons that are gone: the name still resolves as a deprecated constant, but
   * the font has no glyph for it any more. These need a different icon.
   */
  removed: RemovedIcon[];
  /**
   * Icons that kept their glyph under a new canonical name. The old name still
   * compiles as a deprecated alternative that resolves to the new one.
   */
  renamed: RenamedIcon[];
  /** Alternative names that were added, and the icon they resolve to. */
  aliasesAdded: { name: string; icon: string }[];
  /** Alternative names that stopped resolving. */
  aliasesRemoved: string[];
  /**
   * Icons whose code point changed, which should never happen: Lucide allocates
   * a code point once per icon and never reuses it. Anything here means a glyph
   * moved under an existing name.
   */
  movedCodePoints: MovedCodePoint[];
  summary: {
    added: number;
    removed: number;
    renamed: number;
    aliasesAdded: number;
    aliasesRemoved: number;
    movedCodePoints: number;
    unchanged: number;
  };
}

function withIdentifier(name: string) {
  return { name, identifier: toSwiftIdentifier(name) };
}

function sortByName<T extends { name: string }>(entries: T[]): T[] {
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Compares two of the package's icon indexes, so a jump across several Lucide
 * releases can be read in one go instead of release by release.
 */
export function diffIndexes(from: IconIndex, to: IconIndex): IndexDiff {
  const added: AddedIcon[] = [];
  const removed: RemovedIcon[] = [];
  const renamed: RenamedIcon[] = [];
  const aliasesAdded: { name: string; icon: string }[] = [];
  const aliasesRemoved: string[] = [];
  const movedCodePoints: MovedCodePoint[] = [];

  let unchanged = 0;

  for (const [name, codePoint] of Object.entries(from.icons)) {
    if (name in to.icons) {
      if (to.icons[name] !== codePoint) {
        movedCodePoints.push({ name, from: codePoint, to: to.icons[name] });
      } else {
        unchanged += 1;
      }

      continue;
    }

    // The name became an alternative name, so the icon is still there under a
    // new canonical name.
    const canonicalName = to.aliases[name];

    if (canonicalName) {
      renamed.push({
        from: name,
        to: canonicalName,
        fromIdentifier: toSwiftIdentifier(name),
        toIdentifier: toSwiftIdentifier(canonicalName),
        codePoint: to.icons[canonicalName] ?? codePoint,
      });

      continue;
    }

    removed.push({ ...withIdentifier(name), codePoint: to.removed[name] ?? codePoint });
  }

  // A rename is reported once, as a rename. The new canonical name is not also
  // a new icon.
  const renamedTo = new Set(renamed.map((rename) => rename.to));

  for (const [name, codePoint] of Object.entries(to.icons)) {
    if (name in from.icons || renamedTo.has(name)) continue;

    added.push({ ...withIdentifier(name), codePoint });
  }

  for (const [name, icon] of Object.entries(to.aliases)) {
    if (!(name in from.aliases) && !(name in from.icons)) {
      aliasesAdded.push({ name, icon });
    }
  }

  for (const name of Object.keys(from.aliases)) {
    if (!(name in to.aliases) && !(name in to.icons)) {
      aliasesRemoved.push(name);
    }
  }

  return {
    from: {
      lucideVersion: from.lucideVersion,
      iconCount: Object.keys(from.icons).length,
      aliasCount: Object.keys(from.aliases).length,
    },
    to: {
      lucideVersion: to.lucideVersion,
      iconCount: Object.keys(to.icons).length,
      aliasCount: Object.keys(to.aliases).length,
    },
    added: sortByName(added),
    removed: sortByName(removed),
    renamed: renamed.sort((a, b) => a.from.localeCompare(b.from)),
    aliasesAdded: sortByName(aliasesAdded),
    aliasesRemoved: aliasesRemoved.sort((a, b) => a.localeCompare(b)),
    movedCodePoints: sortByName(movedCodePoints),
    summary: {
      added: added.length,
      removed: removed.length,
      renamed: renamed.length,
      aliasesAdded: aliasesAdded.length,
      aliasesRemoved: aliasesRemoved.length,
      movedCodePoints: movedCodePoints.length,
      unchanged,
    },
  };
}

/** A short, readable version of the diff, for a terminal or release notes. */
export function formatDiff(diff: IndexDiff): string {
  const lines = [
    `Lucide ${diff.from.lucideVersion} → ${diff.to.lucideVersion}`,
    `${diff.from.iconCount} icons → ${diff.to.iconCount} icons`,
    '',
  ];

  const section = (title: string, entries: string[]) => {
    if (entries.length === 0) return;

    lines.push(`${title} (${entries.length}):`);
    lines.push(...entries.map((entry) => `  ${entry}`));
    lines.push('');
  };

  section(
    'renamed, the old name still compiles as a deprecated alternative',
    diff.renamed.map(
      (rename) =>
        `${rename.from} → ${rename.to}  (.${rename.fromIdentifier} → .${rename.toIdentifier})`,
    ),
  );
  section(
    'removed, these have no glyph any more and need replacing',
    diff.removed.map((icon) => `${icon.name}  (.${icon.identifier})`),
  );
  section(
    'added',
    diff.added.map((icon) => `${icon.name}  (.${icon.identifier})`),
  );
  section(
    'alternative names added',
    diff.aliasesAdded.map((alias) => `${alias.name} → ${alias.icon}`),
  );
  section('alternative names removed', diff.aliasesRemoved);

  if (diff.movedCodePoints.length > 0) {
    section(
      'code points that moved, which should never happen',
      diff.movedCodePoints.map((moved) => `${moved.name}: ${moved.from} → ${moved.to}`),
    );
  }

  if (
    diff.summary.added === 0 &&
    diff.summary.removed === 0 &&
    diff.summary.renamed === 0 &&
    diff.summary.aliasesAdded === 0 &&
    diff.summary.aliasesRemoved === 0
  ) {
    lines.push('no icons were added, removed or renamed.', '');
  }

  return lines.join('\n');
}
