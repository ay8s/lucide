#if canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit

extension NSFont {
    /// The Lucide icon font at `size`.
    ///
    /// Falls back to the system font of the same size if the bundled font could
    /// not be registered, so this never returns a broken font.
    public static func lucide(ofSize size: CGFloat) -> NSFont {
        LucideFont.register()

        return NSFont(name: LucideFont.postScriptName, size: size) ?? .systemFont(ofSize: size)
    }
}

extension LucideIcon {
    /// An attributed string that draws this icon.
    ///
    /// - Parameters:
    ///   - pointSize: The point size of the glyph.
    ///   - color: The colour to draw with. When `nil`, the drawing context
    ///     decides.
    public func attributedString(
        pointSize: CGFloat,
        color: NSColor? = nil
    ) -> NSAttributedString {
        var attributes: [NSAttributedString.Key: Any] = [.font: NSFont.lucide(ofSize: pointSize)]

        if let color {
            attributes[.foregroundColor] = color
        }

        return NSAttributedString(string: glyph, attributes: attributes)
    }

    /// Renders this icon into an image, for the AppKit APIs that only take
    /// images.
    ///
    /// - Parameters:
    ///   - pointSize: The point size of the glyph.
    ///   - color: The colour to bake into the image. When `nil`, the image is
    ///     marked as a template image so it follows the surrounding style.
    public func image(pointSize: CGFloat, color: NSColor? = nil) -> NSImage {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.lucide(ofSize: pointSize),
            .foregroundColor: color ?? .black,
        ]

        let glyph = self.glyph as NSString
        let image = NSImage(size: glyph.size(withAttributes: attributes), flipped: false) { _ in
            glyph.draw(at: .zero, withAttributes: attributes)
            return true
        }

        image.isTemplate = color == nil

        return image
    }
}
#endif
