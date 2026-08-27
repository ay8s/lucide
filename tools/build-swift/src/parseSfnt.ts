/**
 * A minimal TrueType/OpenType (sfnt) reader.
 *
 * We only need two things from the font that `tools/build-font` produces:
 *
 * - the names to reference it by at runtime (`UIFont(name:)` / `Font.custom`),
 * - which code points actually have a glyph, so names that lost their glyph
 *   (removed icons keep their code point in `codepoints.json` forever) can be
 *   generated as deprecated instead of silently rendering as tofu.
 */

export interface FontInfo {
  familyName: string;
  subfamilyName: string;
  fullName: string;
  postScriptName: string;
  versionString: string | null;
  /** Every code point that maps to a non-zero glyph id. */
  coveredCodePoints: Set<number>;
}

interface TableRecord {
  offset: number;
  length: number;
}

const NAME_ID_FAMILY = 1;
const NAME_ID_SUBFAMILY = 2;
const NAME_ID_VERSION = 5;
const NAME_ID_FULL = 4;
const NAME_ID_POSTSCRIPT = 6;

function readTableDirectory(view: DataView): Map<string, TableRecord> {
  const numTables = view.getUint16(4);
  const tables = new Map<string, TableRecord>();

  for (let index = 0; index < numTables; index += 1) {
    const record = 12 + index * 16;
    const tag = String.fromCharCode(
      view.getUint8(record),
      view.getUint8(record + 1),
      view.getUint8(record + 2),
      view.getUint8(record + 3),
    );

    tables.set(tag, {
      offset: view.getUint32(record + 8),
      length: view.getUint32(record + 12),
    });
  }

  return tables;
}

function decodeNameRecord(
  bytes: Uint8Array,
  platformId: number,
  start: number,
  length: number,
): string {
  const slice = bytes.subarray(start, start + length);

  // Platform 1 (Macintosh) uses single byte encodings, everything else we care
  // about (0 = Unicode, 3 = Windows) uses UTF-16BE.
  if (platformId === 1) {
    return new TextDecoder('latin1').decode(slice);
  }

  return new TextDecoder('utf-16be').decode(slice);
}

function readNames(view: DataView, bytes: Uint8Array, table: TableRecord): Map<number, string> {
  const names = new Map<number, string>();
  const count = view.getUint16(table.offset + 2);
  const stringOffset = view.getUint16(table.offset + 4);

  for (let index = 0; index < count; index += 1) {
    const record = table.offset + 6 + index * 12;
    const platformId = view.getUint16(record);
    const nameId = view.getUint16(record + 6);
    const length = view.getUint16(record + 8);
    const offset = view.getUint16(record + 10);

    if (names.has(nameId)) continue;

    const value = decodeNameRecord(
      bytes,
      platformId,
      table.offset + stringOffset + offset,
      length,
    ).replace(/\0/g, '');

    if (value.length > 0) {
      names.set(nameId, value);
    }
  }

  return names;
}

function readFormat4(view: DataView, subtable: number, covered: Set<number>) {
  const segCountX2 = view.getUint16(subtable + 6);
  const segCount = segCountX2 / 2;
  const endCodes = subtable + 14;
  const startCodes = endCodes + segCountX2 + 2; // + reservedPad
  const idDeltas = startCodes + segCountX2;
  const idRangeOffsets = idDeltas + segCountX2;

  for (let segment = 0; segment < segCount; segment += 1) {
    const startCode = view.getUint16(startCodes + segment * 2);
    const endCode = view.getUint16(endCodes + segment * 2);

    if (startCode === 0xffff) continue;

    const idDelta = view.getInt16(idDeltas + segment * 2);
    const idRangeOffset = view.getUint16(idRangeOffsets + segment * 2);

    for (let codePoint = startCode; codePoint <= endCode; codePoint += 1) {
      let glyphId: number;

      if (idRangeOffset === 0) {
        glyphId = (codePoint + idDelta) & 0xffff;
      } else {
        const glyphIndex =
          idRangeOffsets + segment * 2 + idRangeOffset + (codePoint - startCode) * 2;
        glyphId = view.getUint16(glyphIndex);
        if (glyphId !== 0) {
          glyphId = (glyphId + idDelta) & 0xffff;
        }
      }

      if (glyphId !== 0) {
        covered.add(codePoint);
      }
    }
  }
}

function readFormat12(view: DataView, subtable: number, covered: Set<number>) {
  const groupCount = view.getUint32(subtable + 12);

  for (let group = 0; group < groupCount; group += 1) {
    const record = subtable + 16 + group * 12;
    const startCharCode = view.getUint32(record);
    const endCharCode = view.getUint32(record + 4);
    const startGlyphId = view.getUint32(record + 8);

    if (startGlyphId === 0) continue;

    for (let codePoint = startCharCode; codePoint <= endCharCode; codePoint += 1) {
      covered.add(codePoint);
    }
  }
}

function readCoveredCodePoints(view: DataView, table: TableRecord): Set<number> {
  const covered = new Set<number>();
  const subtableCount = view.getUint16(table.offset + 2);

  for (let index = 0; index < subtableCount; index += 1) {
    const record = table.offset + 4 + index * 8;
    const subtable = table.offset + view.getUint32(record + 4);
    const format = view.getUint16(subtable);

    if (format === 4) {
      readFormat4(view, subtable, covered);
    } else if (format === 12) {
      readFormat12(view, subtable, covered);
    }
    // Format 0 (Macintosh) only covers the first 256 code points, the icons all
    // live in the Private Use Area, so there is nothing to gain from it.
  }

  return covered;
}

export function parseSfnt(font: Uint8Array): FontInfo {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const tables = readTableDirectory(view);

  const nameTable = tables.get('name');
  const cmapTable = tables.get('cmap');

  if (!nameTable) throw new Error('The font has no `name` table.');
  if (!cmapTable) throw new Error('The font has no `cmap` table.');

  const names = readNames(view, font, nameTable);
  const familyName = names.get(NAME_ID_FAMILY);

  if (!familyName) throw new Error('The font has no family name.');

  return {
    familyName,
    subfamilyName: names.get(NAME_ID_SUBFAMILY) ?? 'Regular',
    fullName: names.get(NAME_ID_FULL) ?? familyName,
    postScriptName: names.get(NAME_ID_POSTSCRIPT) ?? familyName,
    versionString: names.get(NAME_ID_VERSION) ?? null,
    coveredCodePoints: readCoveredCodePoints(view, cmapTable),
  };
}
