import { promises as fs } from 'fs';
import path from 'path';

import type { CodePoints } from './collectIcons.ts';

const NPM_REGISTRY = 'https://registry.npmjs.org/lucide-static';
const CDN = 'https://unpkg.com/lucide-static';

export interface FontAssets {
  /** The `lucide-static` version, or `local` for a locally built font. */
  lucideVersion: string;
  font: Uint8Array;
  codePoints: CodePoints;
}

export async function resolveLatestVersion(): Promise<string> {
  const response = await fetch(`${NPM_REGISTRY}/latest`);

  if (!response.ok) {
    throw new Error(`Could not read the latest lucide-static version (${response.status}).`);
  }

  const { version } = (await response.json()) as { version?: string };

  if (!version) {
    throw new Error('The npm registry did not report a lucide-static version.');
  }

  return version;
}

/** Downloads the font and its code points from a published `lucide-static`. */
export async function downloadFontAssets(version: string): Promise<FontAssets> {
  const lucideVersion = version === 'latest' ? await resolveLatestVersion() : version;

  const [fontResponse, codePointsResponse] = await Promise.all([
    fetch(`${CDN}@${lucideVersion}/font/lucide.ttf`),
    fetch(`${CDN}@${lucideVersion}/font/codepoints.json`),
  ]);

  if (!fontResponse.ok) {
    throw new Error(`Could not download lucide.ttf for ${lucideVersion} (${fontResponse.status}).`);
  }

  if (!codePointsResponse.ok) {
    throw new Error(
      `Could not download codepoints.json for ${lucideVersion} (${codePointsResponse.status}).`,
    );
  }

  return {
    lucideVersion,
    font: new Uint8Array(await fontResponse.arrayBuffer()),
    codePoints: (await codePointsResponse.json()) as CodePoints,
  };
}

/** Reads the font and its code points from a locally built `lucide-font`. */
export async function readFontAssets(directory: string, version: string): Promise<FontAssets> {
  const [font, codePointsContents] = await Promise.all([
    fs.readFile(path.join(directory, 'lucide.ttf')),
    fs.readFile(path.join(directory, 'codepoints.json'), 'utf-8'),
  ]);

  return {
    lucideVersion: version,
    font: new Uint8Array(font),
    codePoints: JSON.parse(codePointsContents) as CodePoints,
  };
}
