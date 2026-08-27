import CoreText
import Testing

@testable import {{MODULE}}

@Suite("Bundled font")
struct LucideFontTests {
    @Test("the font registers itself")
    func fontRegisters() {
        #expect(LucideFont.register())
        #expect(LucideFont.isAvailable)
    }

    @Test("registering twice is not a failure")
    func registeringTwiceSucceeds() {
        #expect(LucideFont.register())
        #expect(LucideFont.register())
    }

    @Test("the registered font is the bundled one")
    func fontNamesMatch() throws {
        let font = try #require(LucideFont.ctFont(size: 17))

        #expect(CTFontCopyPostScriptName(font) as String == LucideFont.postScriptName)
        #expect(CTFontCopyFamilyName(font) as String == LucideFont.familyName)
    }

    @Test("the index was generated from the same release as the font")
    func indexMatchesFont() {
        #expect(LucideIconIndex.shared.lucideVersion == LucideFont.lucideVersion)
        #expect(LucideIconIndex.shared.fontPostScriptName == LucideFont.postScriptName)
    }

    @Test("glyph lookup rejects a character the font has no glyph for")
    func glyphLookupRejectsUnknownCharacter() {
        // A Private Use Area code point far past the ones Lucide allocates.
        let notAnIcon = LucideIcon("not-an-icon", codePoint: 0xF8FF)

        #expect(!LucideFont.hasGlyph(for: notAnIcon))
    }
}
