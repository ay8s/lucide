import { describe, expect, it } from 'vitest';

import { parseSfnt } from './parseSfnt.ts';

interface NameRecord {
  nameId: number;
  value: string;
}

interface Segment {
  startCode: number;
  endCode: number;
  /** Glyph ids, one per code point in the segment. `0` means "no glyph". */
  glyphIds: number[];
}

function buildNameTable(records: NameRecord[]): Uint8Array {
  const strings = records.map((record) => Buffer.from(record.value, 'utf16le').swap16());
  const storageOffset = 6 + records.length * 12;
  const table = Buffer.alloc(storageOffset + strings.reduce((total, s) => total + s.length, 0));

  table.writeUInt16BE(0, 0); // format
  table.writeUInt16BE(records.length, 2);
  table.writeUInt16BE(storageOffset, 4);

  let stringOffset = 0;

  records.forEach((record, index) => {
    const offset = 6 + index * 12;

    table.writeUInt16BE(3, offset); // platformID: Windows
    table.writeUInt16BE(1, offset + 2); // encodingID: BMP
    table.writeUInt16BE(0x0409, offset + 4); // languageID
    table.writeUInt16BE(record.nameId, offset + 6);
    table.writeUInt16BE(strings[index].length, offset + 8);
    table.writeUInt16BE(stringOffset, offset + 10);

    strings[index].copy(table, storageOffset + stringOffset);
    stringOffset += strings[index].length;
  });

  return table;
}

/**
 * A `cmap` with a single format 4 subtable. Contiguous segments are written with
 * an `idDelta`, segments with holes in them use a `glyphIdArray`, so both code
 * paths of the parser are covered.
 */
function buildCmapTable(segments: Segment[]): Uint8Array {
  const withTerminator = [...segments, { startCode: 0xffff, endCode: 0xffff, glyphIds: [1] }];
  const segCount = withTerminator.length;

  const contiguous = withTerminator.map((segment) =>
    segment.glyphIds.every(
      (glyphId, index) => glyphId !== 0 && glyphId === segment.glyphIds[0] + index,
    ),
  );

  const glyphIdArrays = withTerminator.map((segment, index) =>
    contiguous[index] ? [] : segment.glyphIds,
  );

  const subtableLength =
    16 + segCount * 8 + glyphIdArrays.reduce((total, ids) => total + ids.length * 2, 0);

  const table = Buffer.alloc(4 + 8 + subtableLength);

  table.writeUInt16BE(0, 0); // version
  table.writeUInt16BE(1, 2); // numTables
  table.writeUInt16BE(3, 4); // platformID
  table.writeUInt16BE(1, 6); // encodingID
  table.writeUInt32BE(12, 8); // subtable offset

  const subtable = 12;
  const endCodes = subtable + 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const idDeltas = startCodes + segCount * 2;
  const idRangeOffsets = idDeltas + segCount * 2;
  let glyphIdArrayOffset = idRangeOffsets + segCount * 2;

  table.writeUInt16BE(4, subtable);
  table.writeUInt16BE(subtableLength, subtable + 2);
  table.writeUInt16BE(0, subtable + 4); // language
  table.writeUInt16BE(segCount * 2, subtable + 6);

  withTerminator.forEach((segment, index) => {
    table.writeUInt16BE(segment.endCode, endCodes + index * 2);
    table.writeUInt16BE(segment.startCode, startCodes + index * 2);

    if (contiguous[index]) {
      table.writeUInt16BE((segment.glyphIds[0] - segment.startCode) & 0xffff, idDeltas + index * 2);
      table.writeUInt16BE(0, idRangeOffsets + index * 2);

      return;
    }

    table.writeUInt16BE(0, idDeltas + index * 2);
    table.writeUInt16BE(
      glyphIdArrayOffset - (idRangeOffsets + index * 2),
      idRangeOffsets + index * 2,
    );

    glyphIdArrays[index].forEach((glyphId, glyphIndex) => {
      table.writeUInt16BE(glyphId, glyphIdArrayOffset + glyphIndex * 2);
    });

    glyphIdArrayOffset += glyphIdArrays[index].length * 2;
  });

  return table;
}

function buildFont(tables: Record<string, Uint8Array>): Uint8Array {
  const tags = Object.keys(tables).sort();
  const directoryLength = 12 + tags.length * 16;
  const font = Buffer.alloc(
    directoryLength + tags.reduce((total, tag) => total + tables[tag].length, 0),
  );

  font.writeUInt32BE(0x00010000, 0); // sfntVersion
  font.writeUInt16BE(tags.length, 4);

  let dataOffset = directoryLength;

  tags.forEach((tag, index) => {
    const record = 12 + index * 16;

    font.write(tag, record, 4, 'latin1');
    font.writeUInt32BE(0, record + 4); // checksum, unused by the parser
    font.writeUInt32BE(dataOffset, record + 8);
    font.writeUInt32BE(tables[tag].length, record + 12);

    Buffer.from(tables[tag]).copy(font, dataOffset);
    dataOffset += tables[tag].length;
  });

  return font;
}

const font = buildFont({
  name: buildNameTable([
    { nameId: 1, value: 'lucide' },
    { nameId: 2, value: 'Regular' },
    { nameId: 4, value: 'lucide regular' },
    { nameId: 5, value: 'Version 1.0' },
    { nameId: 6, value: 'lucide-icons' },
  ]),
  cmap: buildCmapTable([
    { startCode: 0xe000, endCode: 0xe002, glyphIds: [1, 2, 3] },
    { startCode: 0xe010, endCode: 0xe012, glyphIds: [7, 0, 9] },
  ]),
});

describe('parseSfnt', () => {
  it('reads the names the font is referenced by at runtime', () => {
    const info = parseSfnt(font);

    expect(info.familyName).toBe('lucide');
    expect(info.subfamilyName).toBe('Regular');
    expect(info.fullName).toBe('lucide regular');
    expect(info.postScriptName).toBe('lucide-icons');
    expect(info.versionString).toBe('Version 1.0');
  });

  it('reads contiguous segments', () => {
    const { coveredCodePoints } = parseSfnt(font);

    expect(coveredCodePoints.has(0xe000)).toBe(true);
    expect(coveredCodePoints.has(0xe001)).toBe(true);
    expect(coveredCodePoints.has(0xe002)).toBe(true);
  });

  it('leaves out code points that map to glyph 0', () => {
    const { coveredCodePoints } = parseSfnt(font);

    expect(coveredCodePoints.has(0xe010)).toBe(true);
    expect(coveredCodePoints.has(0xe011)).toBe(false);
    expect(coveredCodePoints.has(0xe012)).toBe(true);
  });

  it('leaves out code points the font says nothing about', () => {
    const { coveredCodePoints } = parseSfnt(font);

    expect(coveredCodePoints.has(0xe003)).toBe(false);
    expect(coveredCodePoints.has(0xffff)).toBe(false);
    expect(coveredCodePoints.size).toBe(5);
  });

  it('rejects a file without the tables it needs', () => {
    expect(() =>
      parseSfnt(buildFont({ name: buildNameTable([{ nameId: 1, value: 'x' }]) })),
    ).toThrow('`cmap`');
  });
});
