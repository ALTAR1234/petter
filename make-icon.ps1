# Draws Petter's 512px app icon (icon.png): the blue jelly creature's face on a dark tile.
Add-Type -AssemblyName System.Drawing
$s = 512
$bmp = New-Object System.Drawing.Bitmap $s, $s
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::FromArgb(22, 24, 38))
$c = [System.Drawing.Color]::FromArgb(143, 176, 255)
$ear = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(118, 150, 230))
$g.FillPolygon($ear, [System.Drawing.Point[]]@((New-Object System.Drawing.Point 150, 150), (New-Object System.Drawing.Point 110, 40), (New-Object System.Drawing.Point 230, 110)))
$g.FillPolygon($ear, [System.Drawing.Point[]]@((New-Object System.Drawing.Point 362, 150), (New-Object System.Drawing.Point 402, 40), (New-Object System.Drawing.Point 282, 110)))
$body = New-Object System.Drawing.Rectangle 76, 96, 360, 340
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $body, ([System.Drawing.Color]::FromArgb(200, 218, 255)), $c, 90
$g.FillEllipse($grad, $body)
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(27, 26, 36))
foreach ($ex in 170, 286) { $g.FillEllipse($white, $ex, 210, 58, 68); $g.FillEllipse($ink, $ex + 16, 232, 32, 34); $g.FillEllipse($white, $ex + 30, 236, 10, 10) }
$cheek = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(110, 255, 120, 150))
$g.FillEllipse($cheek, 130, 300, 50, 28); $g.FillEllipse($cheek, 332, 300, 50, 28)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(27, 26, 36)), 12
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'
$g.DrawArc($pen, 226, 296, 60, 40, 20, 140)
$g.Dispose()
$bmp.Save((Join-Path $PSScriptRoot 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
'icon written'
