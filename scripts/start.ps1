$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $projectRoot 'backend'
$envFile = Join-Path $backendDir '.env'
function Read-EnvValue([string]$name) {
    if (Test-Path -LiteralPath $envFile) {
        foreach ($line in Get-Content -LiteralPath $envFile) {
            if ($line -match "^\s*$([regex]::Escape($name))\s*=\s*(.*)$") { return $Matches[1].Trim().Trim('"').Trim("'") }
        }
    }
    return ''
}
$venvPath = Join-Path $projectRoot '.venv\Scripts\Activate.ps1'
if (-not (Test-Path -LiteralPath $venvPath)) {
    $workspaceVenv = Join-Path (Split-Path -Parent $projectRoot) '.venv\Scripts\Activate.ps1'
    if (Test-Path -LiteralPath $workspaceVenv) { $venvPath = $workspaceVenv }
    else { throw "Python environment not found. Create it first: py -3.11 -m venv `"$(Join-Path $projectRoot '.venv')`"" }
}
. $venvPath
if (-not (Test-Path -LiteralPath $envFile)) { throw "Missing $envFile. Copy .env.example to .env and configure MENTOR_PIN." }
$mentorPin = if ($env:MENTOR_PIN) { $env:MENTOR_PIN } else { Read-EnvValue 'MENTOR_PIN' }
if ([string]::IsNullOrWhiteSpace($mentorPin)) { throw 'Set a private MENTOR_PIN in backend/.env before starting the workshop.' }
foreach ($keyName in @('GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'GROQ_API_KEY')) {
    if ([string]::IsNullOrWhiteSpace((Read-EnvValue $keyName)) -and [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($keyName))) { Write-Warning "${keyName} is not set; its Learn provider will be skipped." }
}
$portValue = if ($env:PORT) { $env:PORT } else { Read-EnvValue 'PORT' }
if (-not $portValue) { $portValue = '8000' }
$bindHost = if ($env:HOST) { $env:HOST } else { Read-EnvValue 'HOST' }
if (-not $bindHost) { $bindHost = '0.0.0.0' }
Push-Location $backendDir
try {
    Write-Host 'Checking Python and GPU availability…'
    & python -c 'import importlib.util; print("PyTorch:", "installed" if importlib.util.find_spec("torch") else "not installed"); import torch; print("CUDA:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "not available")' 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Warning 'GPU check could not complete. Check the CUDA PyTorch setup or set DEVICE=cpu for slow local generation.' }
    & python (Join-Path $PSScriptRoot 'print_join_info.py') --port ([int]$portValue)
    if ($LASTEXITCODE -ne 0) { throw 'Could not print workshop join information.' }
    Write-Host "Starting Scribble2Real at http://localhost:$portValue (Ctrl+C to stop)." -ForegroundColor Green
    & python -m uvicorn app.main:app --host $bindHost --port ([int]$portValue)
    if ($LASTEXITCODE -ne 0) { throw 'The workshop server stopped with an error.' }
}
finally { Pop-Location }
