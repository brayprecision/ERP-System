# BPERP Dashboard GUI Launcher
# Professional loading screen with shop logo

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# Get script directory
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = Get-Location }

# Use modern logo with solid background and rounded corners
$logoPath = "$scriptDir\frontend\assets\modern-logo.png"
if (-not (Test-Path $logoPath)) {
    # Fallback to original logos if modern logo not found
    $logoPath = "$scriptDir\context files\shop_logo_app_version.jpg"
}
if (-not (Test-Path $logoPath)) {
    $logoPath = "$scriptDir\context files\Shop Logo.png"
}
if (-not (Test-Path $logoPath)) {
    $logoPath = "$scriptDir\frontend\assets\logo.png"
}

# Create form
$form = New-Object System.Windows.Forms.Form
$form.Text = "BPERP Dashboard"
$form.Width = 500
$form.Height = 420
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(255, 15, 15, 18)
$form.ForeColor = [System.Drawing.Color]::White
$form.TopMost = $true

# Logo
$logo = New-Object System.Windows.Forms.PictureBox
$logo.Width = 180
$logo.Height = 180
$logo.Left = 160
$logo.Top = 15
$logo.SizeMode = "Zoom"
$logo.BackColor = [System.Drawing.Color]::FromArgb(255, 15, 15, 18)
if (Test-Path $logoPath) {
    try { $logo.Image = [System.Drawing.Image]::FromFile($logoPath) } catch {}
}
$form.Controls.Add($logo)

# Title
$title = New-Object System.Windows.Forms.Label
$title.Text = "Bray Precision LLC"
$title.Width = 460
$title.Height = 35
$title.Left = 20
$title.Top = 200
$title.TextAlign = "MiddleCenter"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::White
$title.BackColor = [System.Drawing.Color]::FromArgb(255, 15, 15, 18)
$form.Controls.Add($title)

# Subtitle
$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "ERP Dashboard v2.0"
$subtitle.Width = 460
$subtitle.Height = 25
$subtitle.Left = 20
$subtitle.Top = 238
$subtitle.TextAlign = "MiddleCenter"
$subtitle.Font = New-Object System.Drawing.Font("Segoe UI", 11)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(255, 156, 163, 175)
$subtitle.BackColor = [System.Drawing.Color]::FromArgb(255, 15, 15, 18)
$form.Controls.Add($subtitle)

# Status
$status = New-Object System.Windows.Forms.Label
$status.Text = "Initializing..."
$status.Width = 460
$status.Height = 22
$status.Left = 20
$status.Top = 285
$status.TextAlign = "MiddleCenter"
$status.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$status.ForeColor = [System.Drawing.Color]::FromArgb(255, 16, 185, 129)
$status.BackColor = [System.Drawing.Color]::FromArgb(255, 15, 15, 18)
$form.Controls.Add($status)

# Progress bar
$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Width = 400
$progress.Height = 22
$progress.Left = 50
$progress.Top = 315
$progress.Style = "Continuous"
$progress.Value = 0
$form.Controls.Add($progress)

# Copyright
$copyright = New-Object System.Windows.Forms.Label
$copyright.Text = "© 2026 Bray Precision LLC"
$copyright.Width = 460
$copyright.Height = 18
$copyright.Left = 20
$copyright.Top = 355
$copyright.TextAlign = "MiddleCenter"
$copyright.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$copyright.ForeColor = [System.Drawing.Color]::FromArgb(255, 107, 114, 128)
$copyright.BackColor = [System.Drawing.Color]::FromArgb(255, 15, 15, 18)
$form.Controls.Add($copyright)

# Progress state
$script:step = 0

# Timer
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 600
$timer.Add_Tick({
    $script:step++
    switch ($script:step) {
        1 { $status.Text = "Checking Node.js..."; $progress.Value = 15 }
        2 { $status.Text = "Verifying requirements..."; $progress.Value = 30 }
        3 {
            $status.Text = "Starting backend server..."
            $progress.Value = 45
            try {
                Start-Process cmd -ArgumentList "/c cd /d `"$scriptDir\backend`" && node server.js" -WindowStyle Hidden
            } catch {}
        }
        4 { $status.Text = "Loading modules..."; $progress.Value = 60 }
        5 { $status.Text = "Initializing dashboard..."; $progress.Value = 75 }
        6 { $status.Text = "Connecting..."; $progress.Value = 90 }
        7 { 
            $status.Text = "Opening dashboard..."
            $progress.Value = 100
        }
        8 {
            $timer.Stop()
            Start-Process "http://localhost:3000/loading.html"
            Start-Sleep -Milliseconds 800
            $form.Close()
        }
    }
})

# Form shown event - start timer
$form.Add_Shown({ $timer.Start() })

# Show form
$form.ShowDialog() | Out-Null

# Cleanup
$timer.Dispose()
$form.Dispose()
