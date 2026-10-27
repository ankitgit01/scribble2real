$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot 'backend\.env'
$dataDir = Join-Path $projectRoot 'data'
$publicFile = Join-Path $dataDir 'public_url.txt'
$logBase = Join-Path $env:TEMP "scribble2real-tunnel-$PID"
$stdoutPath = "$logBase.out.log"
$stderrPath = "$logBase.err.log"
function Read-EnvValue([string]$name) {
    if (Test-Path -LiteralPath $envFile) { foreach ($line in Get-Content -LiteralPath $envFile) { if ($line -match "^\s*$([regex]::Escape($name))\s*=\s*(.*)$") { return $Matches[1].Trim().Trim('"').Trim("'") } } }
    return ''
}
$portValue = if ($env:PORT) { $env:PORT } else { Read-EnvValue 'PORT' }
if (-not $portValue) { $portValue = '8000' }
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) { throw 'cloudflared is not installed or is not on PATH. Install it, then rerun this script.' }
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
Remove-Item -LiteralPath $publicFile -Force -ErrorAction SilentlyContinue
$process = $null
try {
    $process = Start-Process -FilePath $cloudflared.Source -ArgumentList @('tunnel', '--url', "http://localhost:$portValue") -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $publicUrl = $null
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline -and -not $process.HasExited -and -not $publicUrl) {
        foreach ($path in @($stdoutPath, $stderrPath)) { if (Test-Path -LiteralPath $path) { $match = [regex]::Match((Get-Content -Raw -LiteralPath $path), 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com'); if ($match.Success) { $publicUrl = $match.Value; break } } }
        if (-not $publicUrl) { Start-Sleep -Seconds 1 }
    }
    if (-not $publicUrl) { throw 'Tunnel URL was not reported within 60 seconds. Check cloudflared output and network access.' }
    [IO.File]::WriteAllText($publicFile, $publicUrl, [Text.UTF8Encoding]::new($false))
    Write-Host "Public workshop URL: $publicUrl" -ForegroundColor Green
    Write-Host 'Tunnel is running. Press Ctrl+C to stop it and clear the saved URL.'
    while (-not $process.HasExited) {
        Start-Sleep -Seconds 3
        $process.Refresh()
    }
    if ($process.ExitCode -ne 0) { throw "cloudflared exited with code $($process.ExitCode)." }
}
finally {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $publicFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
}
