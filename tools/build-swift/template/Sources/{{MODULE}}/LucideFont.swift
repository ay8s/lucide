import CoreGraphics
import CoreText
import Foundation

/// The bundled Lucide icon font.
///
/// The font registers itself with Core Text the first time it is needed, so
/// there is nothing to do at launch. ``register()`` is there for the rare case
/// where you want to register eagerly, or check that it worked.
public enum LucideFont {
    /// Registers the bundled font with Core Text and reports whether the font
    /// can be resolved afterwards. Repeated calls are free.
    @discardableResult
    public static func register() -> Bool { isRegistered }

    /// Whether Core Text can resolve the Lucide font right now.
    public static var isAvailable: Bool { isFontResolvable() }

    /// A Core Text font for the bundled Lucide font at `size`.
    ///
    /// - Returns: `nil` when the font could not be registered.
    public static func ctFont(size: CGFloat) -> CTFont? {
        guard register() else { return nil }

        return CTFontCreateWithName(postScriptName as CFString, size, nil)
    }

    /// Whether the bundled font has a glyph for `icon`.
    ///
    /// An icon that Lucide removed keeps its code point but loses its glyph, so
    /// this is the runtime check for "would this render as blank space?".
    public static func hasGlyph(for icon: LucideIcon) -> Bool {
        guard let font = ctFont(size: 12) else { return false }

        var characters = Array(icon.glyph.utf16)
        var glyphs = [CGGlyph](repeating: 0, count: characters.count)
        let mapped = CTFontGetGlyphsForCharacters(font, &characters, &glyphs, characters.count)

        return mapped && glyphs.allSatisfy { $0 != 0 }
    }

    static let isRegistered: Bool = performRegistration()

    private static func performRegistration() -> Bool {
        guard let url = Bundle.module.url(forResource: fontFileName, withExtension: "ttf") else {
            assertionFailure("{{MODULE}} could not find \(fontFileName).ttf in its bundle.")
            return false
        }

        var error: Unmanaged<CFError>?

        // Always register, even when Core Text can already resolve a font by
        // this name: a machine with an older lucide.ttf installed (Font Book,
        // another app) would otherwise shadow the bundled one and every icon
        // added since that copy would render as blank space. Process scope wins
        // over the user and system scopes, so this settles it.
        if CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
            return true
        }

        let registrationError = error?.takeRetainedValue()

        // Registering the same file twice is reported as an error but leaves the
        // font perfectly usable.
        if let registrationError,
           CFErrorGetCode(registrationError) == Int(CTFontManagerError.alreadyRegistered.rawValue) {
            return true
        }

        // Something else went wrong, but an app that ships its own copy of the
        // font may still have it available, so ask Core Text before giving up.
        return isFontResolvable()
    }

    private static func isFontResolvable() -> Bool {
        // Core Text substitutes a system font for names it doesn't know, so
        // compare the name of what came back.
        let font = CTFontCreateWithName(postScriptName as CFString, 12, nil)

        return (CTFontCopyPostScriptName(font) as String) == postScriptName
    }
}
