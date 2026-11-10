Add-Type -AssemblyName System.Drawing

$resourceDir = Join-Path $PSScriptRoot '..\resources'
New-Item -ItemType Directory -Path $resourceDir -Force | Out-Null

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngBytes = @{}

function New-RoundedRectanglePath {
  param(
    [int]$Width,
    [int]$Height,
    [int]$Radius
  )
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
  $path.AddArc($Width - $diameter, 0, $diameter, $diameter, 270, 90)
  $path.AddArc($Width - $diameter, $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc(0, $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

foreach ($size in $sizes) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $inset = [Math]::Max(1, [Math]::Round($size * 0.03))
  $radius = [Math]::Max(2, [Math]::Round($size * 0.22))
  $path = New-RoundedRectanglePath -Width ($size - 2 * $inset) -Height ($size - 2 * $inset) -Radius $radius
  $matrix = New-Object System.Drawing.Drawing2D.Matrix
  $matrix.Translate($inset, $inset)
  $path.Transform($matrix)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($size, $size)),
    [System.Drawing.Color]::FromArgb(255, 205, 111, 78),
    [System.Drawing.Color]::FromArgb(255, 166, 72, 47)
  )
  $graphics.FillPath($brush, $path)

  $fontSize = [Math]::Max(7, [Math]::Round($size * 0.47))
  $fontFamily = if ($size -le 24) { 'Consolas' } else { 'Cascadia Mono' }
  try {
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  } catch {
    $font = New-Object System.Drawing.Font('Consolas', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  }
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 249, 242))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, -1, $size, $size)
  $graphics.DrawString('>_', $font, $textBrush, $rect, $format)

  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBytes[$size] = $stream.ToArray()

  $graphics.Dispose()
  $bitmap.Dispose()
  $stream.Dispose()
  $font.Dispose()
  $textBrush.Dispose()
  $format.Dispose()
  $brush.Dispose()
  $path.Dispose()
  $matrix.Dispose()
}

[System.IO.File]::WriteAllBytes((Join-Path $resourceDir 'icon.png'), $pngBytes[256])

$icoStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($icoStream)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
foreach ($size in $sizes) {
  $bytes = $pngBytes[$size]
  $dimension = if ($size -ge 256) { 0 } else { $size }
  $writer.Write([Byte]$dimension)
  $writer.Write([Byte]$dimension)
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$bytes.Length)
  $writer.Write([UInt32]$offset)
  $offset += $bytes.Length
}
foreach ($size in $sizes) {
  $writer.Write($pngBytes[$size])
}
$writer.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $resourceDir 'icon.ico'), $icoStream.ToArray())
$writer.Dispose()
$icoStream.Dispose()

