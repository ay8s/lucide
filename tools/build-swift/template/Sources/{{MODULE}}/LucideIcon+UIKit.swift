#if canImport(UIKit)
import UIKit

extension UIFont {
    /// The Lucide icon font at `size`.
    ///
    /// Falls back to the system font of the same size if the bundled font could
    /// not be registered, so this never returns a broken font.
    public static func lucide(ofSize size: CGFloat) -> UIFont {
        LucideFont.register()

        return UIFont(name: LucideFont.postScriptName, size: size) ?? .systemFont(ofSize: size)
    }
}

extension LucideIcon {
    /// An attributed string that draws this icon.
    ///
    /// - Parameters:
    ///   - pointSize: The point size of the glyph.
    ///   - color: The colour to draw with. When `nil`, the drawing context
    ///     decides, which is what you want inside a label that already has a
    ///     text colour.
    public func attributedString(
        pointSize: CGFloat,
        color: UIColor? = nil
    ) -> NSAttributedString {
        var attributes: [NSAttributedString.Key: Any] = [.font: UIFont.lucide(ofSize: pointSize)]

        if let color {
            attributes[.foregroundColor] = color
        }

        return NSAttributedString(string: glyph, attributes: attributes)
    }
}
#endif

#if canImport(UIKit) && !os(watchOS)
extension LucideIcon {
    /// Renders this icon into an image, for the UIKit APIs that only take
    /// images, such as `UITabBarItem` and `UIButton.Configuration`.
    ///
    /// - Parameters:
    ///   - pointSize: The point size of the glyph.
    ///   - color: The colour to bake into the image. When `nil`, the image is
    ///     returned as a template image that picks up the tint colour of
    ///     whatever draws it.
    public func image(pointSize: CGFloat, color: UIColor? = nil) -> UIImage {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.lucide(ofSize: pointSize),
            .foregroundColor: color ?? .black,
        ]

        let glyph = self.glyph as NSString
        let format = UIGraphicsImageRendererFormat.preferred()
        format.opaque = false

        let renderer = UIGraphicsImageRenderer(
            size: glyph.size(withAttributes: attributes),
            format: format
        )

        let image = renderer.image { _ in
            glyph.draw(at: .zero, withAttributes: attributes)
        }

        return color == nil ? image.withRenderingMode(.alwaysTemplate) : image
    }
}
#endif
