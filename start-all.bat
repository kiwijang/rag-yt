@echo off
setlocal
set "RAGYT_START_FILE=%~f0"
set "RAGYT_CHECK_ONLY=0"
if /i "%~1"=="--check" set "RAGYT_CHECK_ONLY=1"
powershell.exe -NoProfile -Command "$raw = [IO.File]::ReadAllText($env:RAGYT_START_FILE); & ([scriptblock]::Create(($raw -split '(?m)^# POWERSHELL-BEGIN\r?$', 2)[1])) -CheckOnly:($env:RAGYT_CHECK_ONLY -eq '1')"
set "RAGYT_EXIT_CODE=%ERRORLEVEL%"
if not "%RAGYT_EXIT_CODE%"=="0" if "%RAGYT_CHECK_ONLY%"=="0" pause
exit /b %RAGYT_EXIT_CODE%
# POWERSHELL-BEGIN
param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $env:RAGYT_START_FILE
$logDir = Join-Path $env:TEMP 'ragyt-startup'

function Test-Ready([string]$Url, [switch]$Api) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        if ($Api) { return (($response.Content | ConvertFrom-Json).status -eq 'ok') }
        return ($response.StatusCode -eq 200 -and $response.Content -match '<app-root')
    } catch { return $false }
}

function Wait-Ready([string]$Url, [switch]$Api) {
    $deadline = (Get-Date).AddSeconds(120)
    do {
        if (Test-Ready $Url -Api:$Api) { return }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    throw "Startup timed out: $Url. See logs in $logDir"
}

function Stop-ExistingApi {
    $ownerIds = @(Get-NetTCPConnection -State Listen -LocalPort 5085 -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if (-not $ownerIds.Count) { return }
    $apiBin = [IO.Path]::GetFullPath((Join-Path $projectRoot 'Rag.Api\bin')) + '\'
    $owners = @($ownerIds | ForEach-Object { Get-Process -Id $_ -ErrorAction Stop })
    # Validate all port owners before stopping any process.
    foreach ($owner in $owners) {
        if (-not $owner.Path -or [IO.Path]::GetFileName($owner.Path) -ne 'Rag.Api.exe' -or
            -not $owner.Path.StartsWith($apiBin, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Port 5085 belongs to another program (PID $($owner.Id)); it was not stopped."
        }
    }
    $processes = @(Get-CimInstance Win32_Process)
    foreach ($owner in $owners) {
        Write-Host "Stopping existing project API (PID $($owner.Id))..."
        $tree = [Collections.Generic.List[int]]::new()
        $tree.Add($owner.Id)
        for ($index = 0; $index -lt $tree.Count; $index++) {
            foreach ($child in $processes | Where-Object ParentProcessId -eq $tree[$index]) {
                if (-not $tree.Contains([int]$child.ProcessId)) { $tree.Add([int]$child.ProcessId) }
            }
        }
        # Stop transcription children too, so a replaced API cannot leave workers behind.
        for ($index = $tree.Count - 1; $index -ge 0; $index--) {
            $process = Get-Process -Id $tree[$index] -ErrorAction SilentlyContinue
            if ($process) { Stop-Process -InputObject $process -ErrorAction Stop }
        }
    }
    $deadline = (Get-Date).AddSeconds(10)
    while (Test-Port 5085) {
        if ((Get-Date) -ge $deadline) { throw 'Port 5085 was not released after stopping the old API.' }
        Start-Sleep -Milliseconds 200
    }
}
function Test-Port([int]$Port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

try {
    Set-Location -LiteralPath $projectRoot
    foreach ($tool in @('docker.exe', 'dotnet.exe', 'node.exe', 'npm.cmd', 'yt-dlp', 'ffmpeg')) {
        $null = Get-Command $tool -ErrorAction Stop
    }
    $pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
    foreach ($required in @($pythonPath, (Join-Path $projectRoot 'frontend\node_modules\.bin\nx.cmd'))) {
        if (-not (Test-Path -LiteralPath $required)) {
            throw "Missing prerequisite: $required. Install project dependencies first; see README.md."
        }
    }
    $env:VIRTUAL_ENV = Join-Path $projectRoot '.venv'
    $env:PATH = (Join-Path $env:VIRTUAL_ENV 'Scripts') + ';' + $env:PATH
    $env:Transcription__PythonExecutable = $pythonPath
    if (-not $env:Transcription__JsRuntime) {
        $env:Transcription__JsRuntime = 'node:' + (Get-Command node.exe).Source
    }

    if ($CheckOnly) {
        Write-Host "Project: $projectRoot"
        Write-Host "Python: $pythonPath"
        Write-Host "Node runtime: $env:Transcription__JsRuntime"
        Write-Host "API ready: $(Test-Ready 'http://localhost:5085/health' -Api)"
        Write-Host "Angular ready: $(Test-Ready 'http://127.0.0.1:4200')"
        & $pythonPath -c "import torch; print('PyTorch:', torch.__version__, 'CUDA available:', torch.cuda.is_available())"
        if ($LASTEXITCODE -ne 0) { throw 'Python inference dependency check failed; install Scripts/requirements-gpu.txt.' }
        Write-Host 'Prerequisite checks passed. No services were started.'
        exit 0
    }

    Stop-ExistingApi
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    Write-Host '[1/3] Starting Docker services...'
    & docker.exe info *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable. Start Docker Desktop, then run this file again.' }
    & docker.exe compose -f (Join-Path $projectRoot 'docker-compose.yml') up -d --wait --wait-timeout 120
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose startup failed; see the Docker output above.' }

    Write-Host '[2/3] Starting Angular...'
    if (Test-Port 4200) {
        if (-not (Test-Ready 'http://127.0.0.1:4200')) {
            throw 'Port 4200 is occupied but the Angular page check failed. Check the existing process.'
        }
        Write-Host 'Angular is already running; reusing it.'
    } else {
        Start-Process -FilePath $env:ComSpec -ArgumentList '/d /c npm run start' `
            -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $logDir 'frontend.stdout.log') `
            -RedirectStandardError (Join-Path $logDir 'frontend.stderr.log') | Out-Null
        Wait-Ready 'http://127.0.0.1:4200'
    }
    Write-Host ''
    Write-Host '[3/3] Starting Rag.Api in this window...'
    Write-Host 'Press Ctrl+C in THIS window to stop the backend API.'
    Write-Host 'Docker and Angular will keep running.'
    Write-Host 'Frontend: http://localhost:4200'
    Write-Host 'API:      http://localhost:5085/swagger'
    Write-Host "Angular logs: $logDir"
    $apiStartedAt = Get-Date
    try {
        & dotnet.exe run --project Rag.Api --launch-profile http
        $apiExitCode = $LASTEXITCODE
    } finally {
        # Only clean up API processes started by this launch, if any remain.
        $apiExe = Join-Path $projectRoot 'Rag.Api\bin\Debug\net10.0\Rag.Api.exe'
        Get-Process -Name 'Rag.Api' -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -eq $apiExe -and $_.StartTime -ge $apiStartedAt } |
            Stop-Process -ErrorAction SilentlyContinue
    }
    exit $apiExitCode
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Logs, if created: $logDir"
    exit 1
}
