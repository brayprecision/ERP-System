#!/bin/bash
# Generate icons for all platforms from source PNG
# Requires: ImageMagick (convert command) and png2icns (for macOS)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_PNG="$SCRIPT_DIR/icon.png"

echo "BPERP Icon Generator"
echo "===================="

if [ ! -f "$SOURCE_PNG" ]; then
    echo "Error: Source icon not found at $SOURCE_PNG"
    echo "Please place a 512x512 or larger PNG file named 'icon.png' in this directory."
    exit 1
fi

# Check for ImageMagick
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is required but not installed."
    echo "Install with: sudo apt install imagemagick (Linux) or brew install imagemagick (macOS)"
    exit 1
fi

echo "Source image: $SOURCE_PNG"
echo ""

# Generate Linux icons (multiple sizes)
echo "Generating Linux icons..."
mkdir -p "$SCRIPT_DIR/icons"
for size in 16 24 32 48 64 128 256 512; do
    convert "$SOURCE_PNG" -resize ${size}x${size} "$SCRIPT_DIR/icons/${size}x${size}.png"
    echo "  Created ${size}x${size}.png"
done
echo "  Linux icons complete!"
echo ""

# Generate Windows ICO (if not exists or needs update)
echo "Generating Windows icon..."
convert "$SOURCE_PNG" -define icon:auto-resize=256,128,64,48,32,16 "$SCRIPT_DIR/icon.ico"
echo "  Created icon.ico"
echo ""

# Generate macOS ICNS
echo "Generating macOS icon..."
if command -v png2icns &> /dev/null; then
    # Create iconset directory
    mkdir -p "$SCRIPT_DIR/icon.iconset"
    
    # Generate all required sizes for macOS
    convert "$SOURCE_PNG" -resize 16x16 "$SCRIPT_DIR/icon.iconset/icon_16x16.png"
    convert "$SOURCE_PNG" -resize 32x32 "$SCRIPT_DIR/icon.iconset/icon_16x16@2x.png"
    convert "$SOURCE_PNG" -resize 32x32 "$SCRIPT_DIR/icon.iconset/icon_32x32.png"
    convert "$SOURCE_PNG" -resize 64x64 "$SCRIPT_DIR/icon.iconset/icon_32x32@2x.png"
    convert "$SOURCE_PNG" -resize 128x128 "$SCRIPT_DIR/icon.iconset/icon_128x128.png"
    convert "$SOURCE_PNG" -resize 256x256 "$SCRIPT_DIR/icon.iconset/icon_128x128@2x.png"
    convert "$SOURCE_PNG" -resize 256x256 "$SCRIPT_DIR/icon.iconset/icon_256x256.png"
    convert "$SOURCE_PNG" -resize 512x512 "$SCRIPT_DIR/icon.iconset/icon_256x256@2x.png"
    convert "$SOURCE_PNG" -resize 512x512 "$SCRIPT_DIR/icon.iconset/icon_512x512.png"
    convert "$SOURCE_PNG" -resize 1024x1024 "$SCRIPT_DIR/icon.iconset/icon_512x512@2x.png"
    
    # Use iconutil on macOS to create icns
    if command -v iconutil &> /dev/null; then
        iconutil -c icns "$SCRIPT_DIR/icon.iconset" -o "$SCRIPT_DIR/icon.icns"
        rm -rf "$SCRIPT_DIR/icon.iconset"
        echo "  Created icon.icns"
    else
        echo "  Note: iconutil not available (requires macOS). iconset created but not converted."
        echo "  Run 'iconutil -c icns icon.iconset' on macOS to create icon.icns"
    fi
else
    echo "  Note: png2icns not available. Skipping macOS icon generation."
    echo "  Install with: brew install libicns (macOS) or generate on macOS"
fi

echo ""
echo "Icon generation complete!"
echo ""
echo "Files created:"
ls -la "$SCRIPT_DIR"/*.ico "$SCRIPT_DIR"/*.png 2>/dev/null || true
ls -la "$SCRIPT_DIR"/*.icns 2>/dev/null || echo "  (no .icns - generate on macOS)"
ls -la "$SCRIPT_DIR/icons/" 2>/dev/null || true
