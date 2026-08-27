// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "{{MODULE}}",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
        .tvOS(.v16),
        .watchOS(.v9),
        .visionOS(.v1),
    ],
    products: [
        .library(name: "{{MODULE}}", targets: ["{{MODULE}}"]),
    ],
    targets: [
        .target(
            name: "{{MODULE}}",
            resources: [
                .copy("Resources/lucide.ttf"),
                .copy("Resources/lucide-icons.json"),
            ]
        ),
        .testTarget(
            name: "{{MODULE}}Tests",
            dependencies: ["{{MODULE}}"]
        ),
    ]
)
