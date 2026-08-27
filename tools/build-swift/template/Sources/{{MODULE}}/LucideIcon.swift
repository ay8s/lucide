import Foundation

/// A single Lucide icon: its canonical kebab-case name and the code point of
/// its glyph in the bundled `lucide` icon font.
///
/// Reference icons through the generated constants rather than through
/// characters or code points, so a name that disappears upstream turns into a
/// compile error instead of a wrong glyph at runtime:
///
/// ```swift
/// LucideIconView(.circleCheck, size: 20)
///
/// Text(LucideIcon.house)
///     .font(.lucide(size: 17))
///     .foregroundStyle(.tint)
/// ```
public struct LucideIcon: Hashable, Sendable, Identifiable, CustomStringConvertible {
    /// The canonical Lucide name, for example `circle-check`.
    public let name: String

    /// The Unicode code point of this icon's glyph in the bundled font.
    ///
    /// Code points are allocated once per icon and never reused, so they stay
    /// stable across Lucide releases.
    public let codePoint: UInt32

    init(_ name: String, codePoint: UInt32) {
        self.name = name
        self.codePoint = codePoint
    }

    public var id: String { name }

    /// The scalar to render with the Lucide font.
    public var unicodeScalar: Unicode.Scalar {
        // Every code point the generator emits sits in the Private Use Area, so
        // this never falls back. The fallback only keeps the property
        // non-optional for call sites.
        Unicode.Scalar(codePoint) ?? "\u{FFFD}"
    }

    /// The character to render with the Lucide font.
    public var character: Character { Character(unicodeScalar) }

    /// The single character string to render with the Lucide font.
    public var glyph: String { String(character) }

    public var description: String { name }
}

extension LucideIcon {
    /// Looks an icon up by name, resolving alternative names to their canonical
    /// icon.
    ///
    /// Use this for names that only exist at runtime, such as an icon name that
    /// arrives from an API or was persisted earlier. Prefer the generated
    /// constants everywhere else: they are checked at compile time.
    ///
    /// - Returns: `nil` when the bundled font has no glyph for `name`, which
    ///   includes names Lucide has removed.
    public init?(name: String) {
        guard let icon = LucideIconIndex.icon(named: name) else { return nil }
        self = icon
    }

    /// Every icon in the bundled font, ordered by name.
    public static var allIcons: [LucideIcon] { LucideIconIndex.sortedIcons }

    /// The canonical name for `name`, or `nil` when the bundled font has no
    /// glyph for it.
    ///
    /// ```swift
    /// LucideIcon.canonicalName(for: "alarm-check")  // "alarm-clock-check"
    /// ```
    public static func canonicalName(for name: String) -> String? {
        LucideIconIndex.icon(named: name)?.name
    }

    /// Names that Lucide has removed.
    ///
    /// They keep their code point, so old data stays readable, but the bundled
    /// font has no glyph for them and ``init(name:)`` does not resolve them.
    public static var removedNames: Set<String> { LucideIconIndex.removedNames }
}

extension LucideIcon: Codable {
    /// Encodes as the canonical icon name, so stored values survive a font
    /// update that shifts code points around.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(name)
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        let name = try container.decode(String.self)

        guard let icon = LucideIcon(name: name) else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "'\(name)' is not a Lucide icon in this version of the font."
            )
        }

        self = icon
    }
}
