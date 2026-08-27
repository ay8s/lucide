#if canImport(SwiftUI)
import SwiftUI

extension Font {
    /// The Lucide icon font at a fixed point size.
    public static func lucide(size: CGFloat) -> Font {
        LucideFont.register()

        return .custom(LucideFont.postScriptName, fixedSize: size)
    }

    /// The Lucide icon font at `size`, scaling with Dynamic Type relative to
    /// `textStyle`.
    public static func lucide(size: CGFloat, relativeTo textStyle: Font.TextStyle) -> Font {
        LucideFont.register()

        return .custom(LucideFont.postScriptName, size: size, relativeTo: textStyle)
    }
}

extension Text {
    /// Draws `icon`'s glyph, leaving the font to you.
    ///
    /// The glyphs live in the Private Use Area, so they only render with the
    /// Lucide font applied:
    ///
    /// ```swift
    /// Text(LucideIcon.house)
    ///     .font(.lucide(size: 17))
    /// ```
    public init(_ icon: LucideIcon) {
        self.init(verbatim: icon.glyph)
    }

    /// Draws `icon`'s glyph with the Lucide font already applied, ready to
    /// concatenate with other text.
    ///
    /// ```swift
    /// Text(LucideIcon.circleCheck, size: 15) + Text(" Published")
    /// ```
    ///
    /// - Parameters:
    ///   - icon: The icon to draw.
    ///   - size: The point size of the glyph.
    ///   - textStyle: The text style to scale with under Dynamic Type. Pass
    ///     `nil` to keep the glyph at a fixed size.
    public init(_ icon: LucideIcon, size: CGFloat, relativeTo textStyle: Font.TextStyle? = .body) {
        let font: Font = textStyle.map { .lucide(size: size, relativeTo: $0) }
            ?? .lucide(size: size)

        self = Text(verbatim: icon.glyph).font(font)
    }
}

extension LocalizedStringKey.StringInterpolation {
    /// Puts a Lucide icon inline in a string, between words:
    ///
    /// ```swift
    /// Text("Saved to \(LucideIcon.folder) Drafts")
    /// ```
    ///
    /// The interpolated run carries the Lucide font, since the glyphs don't
    /// render in any other one. Pass `size` to match the surrounding text.
    ///
    /// - Parameters:
    ///   - icon: The icon to draw.
    ///   - size: The point size of the glyph.
    ///   - textStyle: The text style to scale with under Dynamic Type. Pass
    ///     `nil` to keep the glyph at a fixed size.
    public mutating func appendInterpolation(
        _ icon: LucideIcon,
        size: CGFloat = 17,
        relativeTo textStyle: Font.TextStyle? = .body
    ) {
        appendInterpolation(Text(icon, size: size, relativeTo: textStyle))
    }
}

/// A Lucide icon, sized in points and tinted by the current foreground style.
///
/// The icon is drawn as text, so it stays vector at any size, follows
/// `foregroundStyle` and scales with Dynamic Type. Use ``SwiftUI/Image/init(_:pointSize:)``
/// instead when an API insists on an `Image`.
///
/// ```swift
/// LucideIconView(.circleCheck, size: 20)
///     .foregroundStyle(.green)
/// ```
public struct LucideIconView: View {
    private let icon: LucideIcon
    private let size: CGFloat
    private let textStyle: Font.TextStyle?
    private let label: Text?

    /// - Parameters:
    ///   - icon: The icon to draw.
    ///   - size: The point size of the glyph.
    ///   - textStyle: The text style to scale with under Dynamic Type. Pass
    ///     `nil` to keep the glyph at a fixed size.
    ///   - label: An accessibility label. When `nil`, the icon is treated as
    ///     decorative and hidden from assistive technologies.
    public init(
        _ icon: LucideIcon,
        size: CGFloat = 20,
        relativeTo textStyle: Font.TextStyle? = .body,
        label: Text? = nil
    ) {
        self.icon = icon
        self.size = size
        self.textStyle = textStyle
        self.label = label
    }

    public var body: some View {
        if let label {
            glyph.accessibilityLabel(label)
        } else {
            glyph.accessibilityHidden(true)
        }
    }

    private var glyph: some View {
        Text(icon, size: size, relativeTo: textStyle)
            .lineLimit(1)
            .fixedSize()
    }
}

// Building a view is main actor work, and `LucideIconView`, like every other
// `View`, is isolated to it.
@MainActor
extension Label where Title == Text, Icon == LucideIconView {
    /// A label with a Lucide icon, for menus, toolbars and lists.
    ///
    /// ```swift
    /// Button(role: .destructive) { delete() } label: {
    ///     Label("Delete", lucide: .trash2)
    /// }
    /// ```
    public init(_ titleKey: LocalizedStringKey, lucide icon: LucideIcon, size: CGFloat = 20) {
        self.init {
            Text(titleKey)
        } icon: {
            LucideIconView(icon, size: size)
        }
    }

    /// A label with a Lucide icon and a title that is already a string.
    public init(_ title: some StringProtocol, lucide icon: LucideIcon, size: CGFloat = 20) {
        self.init {
            Text(title)
        } icon: {
            LucideIconView(icon, size: size)
        }
    }
}
#endif

#if canImport(SwiftUI) && canImport(UIKit) && !os(watchOS)
import SwiftUI
import UIKit

extension Image {
    /// A Lucide icon rasterised into an image, for the APIs that take an
    /// `Image` rather than a view: `ShareLink`, `Menu`, `UIImage` bridges.
    ///
    /// The image is a template image, so it still follows the foreground style.
    /// Prefer ``LucideIconView`` where you can: it stays vector and scales with
    /// Dynamic Type, this is rasterised at `pointSize`.
    public init(_ icon: LucideIcon, pointSize: CGFloat = 20) {
        self = Image(uiImage: icon.image(pointSize: pointSize)).renderingMode(.template)
    }
}
#endif

#if canImport(SwiftUI) && canImport(AppKit) && !targetEnvironment(macCatalyst)
import AppKit
import SwiftUI

extension Image {
    /// A Lucide icon rasterised into an image, for the APIs that take an
    /// `Image` rather than a view.
    ///
    /// The image is a template image, so it still follows the foreground style.
    /// Prefer ``LucideIconView`` where you can: it stays vector and scales with
    /// Dynamic Type, this is rasterised at `pointSize`.
    public init(_ icon: LucideIcon, pointSize: CGFloat = 20) {
        self = Image(nsImage: icon.image(pointSize: pointSize)).renderingMode(.template)
    }
}
#endif
