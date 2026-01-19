# Fix BPERP Logo - Scale up to fill the icon, cropping out source image's internal padding

Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

$sourcePath = Join-Path $scriptDir "context files\shop_logo_app_version.jpg"
$destPath = Join-Path $scriptDir "frontend\assets\modern-logo.png"

if (-not (Test-Path $sourcePath)) {
    Write-Host "Error: Source logo file not found" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Fixing app logo..." -ForegroundColor Cyan

try {
    $sourceImage = New-Object System.Drawing.Bitmap($sourcePath)
    $bgColor = [System.Drawing.Color]::FromArgb(255, 18, 18, 26)
    
    # Process source - replace checkerboard
    $workBitmap = New-Object System.Drawing.Bitmap($sourceImage.Width, $sourceImage.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    
    for ($x = 0; $x -lt $sourceImage.Width; $x++) {
        for ($y = 0; $y -lt $sourceImage.Height; $y++) {
            $pixel = $sourceImage.GetPixel($x, $y)
            
            $isLightGray = ($pixel.R -gt 180 -and $pixel.R -lt 210) -and ($pixel.G -gt 180 -and $pixel.G -lt 210) -and ($pixel.B -gt 180 -and $pixel.B -lt 210)
            $isWhite = ($pixel.R -gt 240) -and ($pixel.G -gt 240) -and ($pixel.B -gt 240)
            $isNearWhite = ($pixel.R -gt 220 -and $pixel.G -gt 220 -and $pixel.B -gt 220)
            $isCheckerLight = [Math]::Abs($pixel.R - 204) -lt 15 -and [Math]::Abs($pixel.G - 204) -lt 15 -and [Math]::Abs($pixel.B - 204) -lt 15
            $isCheckerDark = [Math]::Abs($pixel.R - 153) -lt 15 -and [Math]::Abs($pixel.G - 153) -lt 15 -and [Math]::Abs($pixel.B - 153) -lt 15
            
            if ($isLightGray -or $isWhite -or $isNearWhite -or $isCheckerLight -or $isCheckerDark) {
                $workBitmap.SetPixel($x, $y, $bgColor)
            } else {
                $workBitmap.SetPixel($x, $y, $pixel)
            }
        }
    }
    
    Write-Host "Checkerboard replaced" -ForegroundColor Green

    $outputSize = 256
    $cornerRadius = 40
    
    # Scale logo LARGER than the output to crop out the source's internal padding
    # The source has ~15% padding around the gear, so scale up by ~1.35x
    $scaledSize = [int]($outputSize * 1.35)
    $offset = [int](($outputSize - $scaledSize) / 2)  # This will be negative, centering the oversized image

    $finalBitmap = New-Object System.Drawing.Bitmap($outputSize, $outputSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($finalBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graphics.Clear($bgColor)

    # Create rounded rectangle for clipping
    $roundedRect = New-Object System.Drawing.Drawing2D.GraphicsPath
    $roundedRect.AddArc(0, 0, $cornerRadius * 2, $cornerRadius * 2, 180, 90)
    $roundedRect.AddArc($outputSize - $cornerRadius * 2, 0, $cornerRadius * 2, $cornerRadius * 2, 270, 90)
    $roundedRect.AddArc($outputSize - $cornerRadius * 2, $outputSize - $cornerRadius * 2, $cornerRadius * 2, $cornerRadius * 2, 0, 90)
    $roundedRect.AddArc(0, $outputSize - $cornerRadius * 2, $cornerRadius * 2, $cornerRadius * 2, 90, 90)
    $roundedRect.CloseFigure()
    
    $graphics.SetClip($roundedRect)
    
    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $graphics.FillRectangle($brush, 0, 0, $outputSize, $outputSize)
    
    # Draw oversized logo - the clipping will crop it to the rounded rectangle
    $destRect = New-Object System.Drawing.Rectangle($offset, $offset, $scaledSize, $scaledSize)
    $graphics.DrawImage($workBitmap, $destRect)
    
    $graphics.ResetClip()
    
    # Add subtle accent border
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 107, 53), 2)
    $graphics.DrawPath($borderPen, $roundedRect)

    $finalBitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $brush.Dispose()
    $borderPen.Dispose()
    $graphics.Dispose()
    $finalBitmap.Dispose()
    $workBitmap.Dispose()
    $sourceImage.Dispose()

    Write-Host "Logo fixed - gear/bolt now fills to the border!" -ForegroundColor Green
    Write-Host "Saved to: $destPath" -ForegroundColor Cyan

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")