import { toSwiftIdentifier } from './swiftIdentifier.ts';

export type CodePoints = Record<string, number>;

export interface AliasMetadata {
  name: string;
  deprecated?: boolean;
  deprecationReason?: string;
}

export interface IconMetadata {
  categories?: string[];
  tags?: string[];
  aliases?: AliasMetadata[];
  deprecated?: boolean;
  deprecationReason?: string;
}

export interface GeneratedIcon {
  name: string;
  identifier: string;
  codePoint: number;
  categories: string[];
  aliasNames: string[];
  deprecated: boolean;
}

export interface GeneratedAlias {
  name: string;
  identifier: string;
  codePoint: number;
  iconName: string;
  iconIdentifier: string;
  deprecated: boolean;
}

export interface GeneratedRemoval {
  name: string;
  identifier: string;
  codePoint: number;
}

export interface IconSet {
  icons: GeneratedIcon[];
  aliases: GeneratedAlias[];
  removed: GeneratedRemoval[];
  unreleased: string[];
  warnings: string[];
}

interface CollectIconsOptions {
  /** `codepoints.json` as shipped with the font: every name ever released. */
  codePoints: CodePoints;
  /** Code points that actually have a glyph in the font. */
  coveredCodePoints: Set<number>;
  /** Contents of the repository's `icons/*.json`, keyed by icon name. */
  metadata: Record<string, IconMetadata>;
}

/**
 * Splits every name in `codepoints.json` into the three groups the Swift
 * package cares about:
 *
 * - `icons`: canonical names with a glyph, generated as `LucideIcon.someIcon`,
 * - `aliases`: alternative names with a glyph, generated as deprecated when the
 *   icon metadata says so,
 * - `removed`: names that kept their code point but lost their glyph, generated
 *   as deprecated so existing call sites keep compiling with a warning instead
 *   of rendering an empty box.
 */
export function collectIcons({
  codePoints,
  coveredCodePoints,
  metadata,
}: CollectIconsOptions): IconSet {
  const warnings: string[] = [];
  const icons: GeneratedIcon[] = [];
  const aliases: GeneratedAlias[] = [];
  const removed: GeneratedRemoval[] = [];
  const unreleased: string[] = [];

  const identifierOwners = new Map<string, string>();
  const metadataNames = Object.keys(metadata).sort((a, b) => a.localeCompare(b));
  const aliasOwners = new Map<string, { icon: string; deprecated: boolean }>();

  for (const iconName of metadataNames) {
    for (const alias of metadata[iconName].aliases ?? []) {
      aliasOwners.set(alias.name, {
        icon: iconName,
        deprecated: alias.deprecated === true,
      });
    }
  }

  // Fall back to the font itself when there is no metadata to read, so the
  // generator also works outside of the lucide repository.
  const canonicalNames =
    metadataNames.length > 0
      ? metadataNames
      : Object.keys(codePoints)
          .filter((name) => coveredCodePoints.has(codePoints[name]))
          .sort((a, b) => a.localeCompare(b));

  for (const iconName of canonicalNames) {
    const codePoint = codePoints[iconName];

    if (codePoint === undefined) {
      // The icon was added to the repository but no font has been released with
      // it yet, so there is no code point to point Swift at.
      unreleased.push(iconName);
      continue;
    }

    if (!coveredCodePoints.has(codePoint)) {
      warnings.push(
        `'${iconName}' has code point ${codePoint} but no glyph in the font, skipping it.`,
      );
      continue;
    }

    const identifier = toSwiftIdentifier(iconName);
    const owner = identifierOwners.get(identifier);

    if (owner) {
      warnings.push(
        `'${iconName}' and '${owner}' both map to the Swift name '${identifier}', skipping '${iconName}'.`,
      );
      continue;
    }

    identifierOwners.set(identifier, iconName);

    const iconMetadata = metadata[iconName] ?? {};

    icons.push({
      name: iconName,
      identifier,
      codePoint,
      categories: iconMetadata.categories ?? [],
      aliasNames: (iconMetadata.aliases ?? []).map((alias) => alias.name),
      deprecated: iconMetadata.deprecated === true,
    });
  }

  const iconsByName = new Map(icons.map((icon) => [icon.name, icon]));

  for (const [aliasName, { icon: iconName, deprecated }] of [...aliasOwners].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const icon = iconsByName.get(iconName);

    if (!icon) continue;

    const identifier = toSwiftIdentifier(aliasName);
    const owner = identifierOwners.get(identifier);

    if (owner) {
      // `arrow-down-01` is an alias of `arrow-down-0-1`; both camel case to
      // `arrowDown01`, so the alias has nothing to add.
      warnings.push(
        `Alias '${aliasName}' maps to the Swift name '${identifier}' which is already taken by '${owner}', skipping it.`,
      );
      continue;
    }

    identifierOwners.set(identifier, aliasName);

    // Aliases that predate their canonical name have a legacy code point of
    // their own in codepoints.json, pointing at a copy of the same glyph. The
    // alias resolves to the canonical code point instead, so an alias constant
    // is equal to the icon it stands for.
    aliases.push({
      name: aliasName,
      identifier,
      codePoint: icon.codePoint,
      iconName: icon.name,
      iconIdentifier: icon.identifier,
      deprecated,
    });
  }

  for (const [name, codePoint] of Object.entries(codePoints).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (coveredCodePoints.has(codePoint)) continue;
    if (iconsByName.has(name) || aliasOwners.has(name)) continue;

    const identifier = toSwiftIdentifier(name);
    const owner = identifierOwners.get(identifier);

    if (owner) {
      warnings.push(
        `Removed name '${name}' maps to the Swift name '${identifier}' which is already taken by '${owner}', skipping it.`,
      );
      continue;
    }

    identifierOwners.set(identifier, name);
    removed.push({ name, identifier, codePoint });
  }

  return { icons, aliases, removed, unreleased, warnings };
}
