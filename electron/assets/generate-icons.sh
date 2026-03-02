#!/bin/bash
# Generate icons for Windows and Linux from source PNG
# Requires: ImageMagick (convert command)

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
    echo "Install with: sudo apt install imagemagick (Linux)"
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

# Generate Windows ICO
echo "Generating Windows icon..."
convert "$SOURCE_PNG" -define icon:auto-resize=256,128,64,48,32,16 "$SCRIPT_DIR/icon.ico"
echo "  Created icon.ico"
echo ""

echo "Icon generation complete!"
echo ""
echo "Files created:"
ls -la "$SCRIPT_DIR"/*.ico "$SCRIPT_DIR"/*.png 2>/dev/null || true
ls -la "$SCRIPT_DIR/icons/" 2>/dev/null || true
