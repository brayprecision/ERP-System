# Convert App Logo PNG to ICO for BPERP shortcuts
# Creates icon with dark background (matching app theme) to avoid checkerboard

Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Use PNG with the gear/lightning logo
$sourceFiles = @(
    "$scriptDir\context files\Shop Logo.png",
    "$scriptDir\frontend\assets\logo.png"
)

$sourcePath = $null
foreach ($file in $sourceFiles) {
    if (Test-Path $file) {
        $sourcePath = $file
        break
    }
}

$destIco = Join-Path $scriptDir "frontend\assets\bperp-icon.ico"

if (-not $sourcePath) {
    Write-Host "No PNG logo file found." -ForegroundColor Yellow
    pause
    exit
}

Write-Host "Creating icon from: $sourcePath" -ForegroundColor Cyan

try {
    # Load the source image
    $image = [System.Drawing.Image]::FromFile($sourcePath)
    
    # Create 256x256 bitmap with solid dark background
    $bitmap = New-Object System.Drawing.Bitmap(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Fill with dark background color (matching the app theme)
    $darkBg = [System.Drawing.Color]::FromArgb(255, 15, 15, 18)
    $graphics.Clear($darkBg)
    
    # Calculate centered position with padding
    $padding = 16
    $destSize = 256 - ($padding * 2)
    
    # Draw the image centered with some padding
    $graphics.DrawImage($image, $padding, $padding, $destSize, $destSize)
    $graphics.Dispose()
    
    # Create icon from bitmap
    $iconHandle = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    
    # Save the icon
    $fs = [System.IO.FileStream]::new($destIco, [System.IO.FileMode]::Create)
    $icon.Save($fs)
    $fs.Close()
    
    # Cleanup
    $bitmap.Dispose()
    $image.Dispose()
    
    Write-Host ""
    Write-Host "Icon created with dark background!" -ForegroundColor Green
    Write-Host "Saved to: $destIco" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error creating icon: $($_.Exception.Message)" -ForegroundColor Red
}
