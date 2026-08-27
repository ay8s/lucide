import Foundation

/// The name to code point table that ships next to the font.
///
/// Only the runtime lookups (``LucideIcon/init(name:)``,
/// ``LucideIcon/allIcons``) read it, the generated constants carry their own
/// code point. Keeping the table out of Swift source keeps compile times down.
struct LucideIconIndex: Decodable, Sendable {
    let lucideVersion: String
    let fontFamilyName: String
    let fontPostScriptName: String

    /// Canonical icon names and their code points.
    let icons: [String: UInt32]

    /// Alternative names and the canonical icon they resolve to.
    let aliases: [String: String]

    /// Names that lost their glyph, and the code point they used to have.
    let removed: [String: UInt32]

    static let shared: LucideIconIndex = load()

    static let sortedIcons: [LucideIcon] = shared.icons
        .map { LucideIcon($0.key, codePoint: $0.value) }
        .sorted { $0.name < $1.name }

    static let removedNames: Set<String> = Set(shared.removed.keys)

    static func icon(named name: String) -> LucideIcon? {
        let index = shared

        if let codePoint = index.icons[name] {
            return LucideIcon(name, codePoint: codePoint)
        }

        if let canonicalName = index.aliases[name], let codePoint = index.icons[canonicalName] {
            return LucideIcon(canonicalName, codePoint: codePoint)
        }

        return nil
    }

    private static func load() -> LucideIconIndex {
        guard let url = Bundle.module.url(forResource: "lucide-icons", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let index = try? JSONDecoder().decode(LucideIconIndex.self, from: data)
        else {
            assertionFailure("{{MODULE}} could not read lucide-icons.json from its bundle.")

            return LucideIconIndex(
                lucideVersion: "",
                fontFamilyName: LucideFont.familyName,
                fontPostScriptName: LucideFont.postScriptName,
                icons: [:],
                aliases: [:],
                removed: [:]
            )
        }

        return index
    }
}
