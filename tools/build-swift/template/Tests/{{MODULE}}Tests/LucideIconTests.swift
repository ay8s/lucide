import Foundation
import Testing

@testable import {{MODULE}}

@Suite("Generated icons")
struct GeneratedIconTests {
    @Test("every generated constant carries the name it was generated for")
    func constantNamesMatch() {
        for (name, icon) in generatedIconConstants {
            #expect(icon.name == name)
        }
    }

    @Test("every generated constant is in the bundled index")
    func constantsAreIndexed() {
        for (name, icon) in generatedIconConstants {
            #expect(LucideIcon(name: name) == icon, "'\(name)' is missing from the index")
        }
    }

    @Test("the index holds nothing the generated constants don't cover")
    func indexHasNoExtraIcons() {
        let generatedNames = Set(generatedIconConstants.map(\.name))
        let indexedNames = Set(LucideIcon.allIcons.map(\.name))

        #expect(generatedNames == indexedNames)
    }

    @Test("the icon count matches the bundled font")
    func iconCountMatches() {
        #expect(generatedIconConstants.count == LucideFont.iconCount)
        #expect(LucideIcon.allIcons.count == LucideFont.iconCount)
    }

    @Test("every generated constant has a glyph in the bundled font")
    func everyIconHasAGlyph() {
        let missing = generatedIconConstants
            .filter { !LucideFont.hasGlyph(for: $0.icon) }
            .map(\.name)

        #expect(missing.isEmpty, "no glyph for: \(missing.prefix(10).joined(separator: ", "))")
    }

    @Test("code points are unique per icon")
    func codePointsAreUnique() {
        var owners: [UInt32: String] = [:]

        for (name, icon) in generatedIconConstants {
            if let owner = owners[icon.codePoint] {
                Issue.record("'\(name)' and '\(owner)' share code point \(icon.codePoint)")
            }

            owners[icon.codePoint] = name
        }
    }
}

@Suite("Alternative and removed names")
struct AliasTests {
    @Test("every alias resolves to its canonical icon")
    func aliasesResolve() {
        for (alias, iconName) in generatedAliasNames {
            #expect(
                LucideIcon.canonicalName(for: alias) == iconName,
                "'\(alias)' does not resolve to '\(iconName)'"
            )
        }
    }

    @Test("removed names do not resolve and have no glyph")
    func removedNamesDoNotResolve() {
        for name in generatedRemovedNames {
            #expect(LucideIcon(name: name) == nil, "'\(name)' still resolves")
            #expect(LucideIcon.removedNames.contains(name))
        }
    }

    @Test("unknown names do not resolve")
    func unknownNamesDoNotResolve() {
        #expect(LucideIcon(name: "not-an-icon") == nil)
        #expect(LucideIcon(name: "") == nil)
    }
}

@Suite("Persisting icons")
struct CodableTests {
    @Test("an icon round trips as its name")
    func roundTrip() throws {
        let data = try JSONEncoder().encode(LucideIcon.house)

        #expect(String(decoding: data, as: UTF8.self) == "\"house\"")
        #expect(try JSONDecoder().decode(LucideIcon.self, from: data) == LucideIcon.house)
    }

    @Test("an alias decodes to its canonical icon")
    func aliasDecodes() throws {
        let data = Data("\"alarm-check\"".utf8)

        #expect(try JSONDecoder().decode(LucideIcon.self, from: data) == .alarmClockCheck)
    }

    @Test("an unknown name fails to decode")
    func unknownNameFailsToDecode() {
        let data = Data("\"not-an-icon\"".utf8)

        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(LucideIcon.self, from: data)
        }
    }
}

#if canImport(SwiftUI)
import SwiftUI

@Suite("SwiftUI surface")
@MainActor
struct SwiftUITests {
    @Test("a text run carries the Lucide font, so it can be concatenated")
    func textRunsConcatenate() {
        _ = Text(LucideIcon.circleCheck, size: 15) + Text(verbatim: " Published")
        _ = Text(LucideIcon.house).font(.lucide(size: 17))
        _ = Text(LucideIcon.house, size: 17, relativeTo: nil)
    }

    @Test("an icon interpolates into a string, inline between words")
    func iconsInterpolate() {
        _ = Text("Saved to \(LucideIcon.folder) Drafts")
        _ = Text("Saved to \(LucideIcon.folder, size: 13) Drafts")
        _ = Text("Fixed size \(LucideIcon.folder, size: 13, relativeTo: nil)")
    }

    @Test("the view and the label take an icon")
    func viewsTakeIcons() {
        _ = LucideIconView(.circleCheck)
        _ = LucideIconView(.circleCheck, size: 24, relativeTo: .headline, label: Text(verbatim: "Done"))
        _ = Label("Delete", lucide: .trash2)
        _ = Label(String("Delete"), lucide: .trash2, size: 17)
    }

    @Test("an icon rasterises into an image for the APIs that need one")
    func iconsRasterise() {
        _ = Image(.circleCheck)
        _ = Image(.circleCheck, pointSize: 24)
    }
}
#endif

#if canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit

@Suite("AppKit rendering")
struct AppKitTests {
    @Test("an icon renders into a template image with a size")
    func imageHasSizeAndIsTemplate() {
        let image = LucideIcon.circleCheck.image(pointSize: 24)

        #expect(image.size.width > 0)
        #expect(image.size.height > 0)
        #expect(image.isTemplate)
    }

    @Test("a colour is baked in, and the image is no longer a template")
    func colouredImageIsNotATemplate() {
        #expect(!LucideIcon.circleCheck.image(pointSize: 24, color: .red).isTemplate)
    }

    @Test("an attributed string uses the Lucide font")
    func attributedStringUsesTheFont() throws {
        let attributed = LucideIcon.house.attributedString(pointSize: 17)
        let font = attributed.attribute(.font, at: 0, effectiveRange: nil) as? NSFont

        #expect(attributed.string == LucideIcon.house.glyph)
        #expect(font?.fontName == LucideFont.postScriptName)
        #expect(font?.pointSize == 17)
    }
}
#endif
