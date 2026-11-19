param(
    [string]$ServiceUrl = '',
    [string]$Model = 'gemma4:12b',
    [string]$LogDirectory = '',
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
if (-not $ServiceUrl) { $ServiceUrl = $env:Ollama__BaseUrl }
if (-not $ServiceUrl) { $ServiceUrl = 'http://localhost:11434' }
if (-not $LogDirectory) { $LogDirectory = Join-Path $env:TEMP 'ragyt-startup' }
$ServiceUrl = $ServiceUrl.TrimEnd('/')
$endpoint = $null
if (-not [Uri]::TryCreate($ServiceUrl, [UriKind]::Absolute, [ref]$endpoint) -or $endpoint.Scheme -notin @('http', 'https')) {
    throw 'Ollama URL must be an absolute HTTP/HTTPS URL.'
}

function Get-OllamaModels {
    try {
        $response = Invoke-RestMethod -Uri ($ServiceUrl + '/api/tags') -TimeoutSec 3
        if ($null -eq $response -or $null -eq $response.PSObject.Properties['models']) { return $null }
        return $response
    } catch { return $null }
}

function Get-OllamaExecutable {
    $command = Get-Command ollama.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $installedPath = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
    if (Test-Path -LiteralPath $installedPath) { return $installedPath }
    throw 'Ollama is not installed or cannot be found. Install Ollama, reopen the terminal, and run start-all.bat again.'
}

$models = Get-OllamaModels
if (-not $models) {
    if ($CheckOnly) { throw "Ollama is not ready at $ServiceUrl. Check mode did not start any service." }
    if (-not $endpoint.IsLoopback -or $endpoint.Scheme -ne 'http' -or $endpoint.AbsolutePath -ne '/') {
        throw "Ollama is unavailable at $ServiceUrl. Start the configured remote/proxied service first."
    }
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $endpoint.Port -ErrorAction SilentlyContinue)
    if ($listeners.Count) {
        throw "Port $($endpoint.Port) is occupied but the Ollama API is not ready. The existing process was not stopped."
    }
    $executable = Get-OllamaExecutable
    New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
    # This environment is scoped to the helper process and its Ollama children.
    $env:OLLAMA_HOST = $ServiceUrl
    Write-Host "Starting Ollama service at $ServiceUrl..."
    $server = Start-Process -FilePath $executable -ArgumentList 'serve' -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $LogDirectory 'ollama.stdout.log') `
        -RedirectStandardError (Join-Path $LogDirectory 'ollama.stderr.log')
    $startup = [Diagnostics.Stopwatch]::StartNew()
    do {
        $models = Get-OllamaModels
        if ($models) { break }
        if ($server.HasExited) { throw "Ollama exited during startup. See $LogDirectory\ollama.stderr.log" }
        Start-Sleep -Seconds 1
    } while ($startup.Elapsed.TotalSeconds -lt 60)
    if (-not $models) { throw "Ollama startup timed out. See $LogDirectory\ollama.stderr.log" }
} else {
    Write-Host "Ollama is already running at $ServiceUrl; reusing it."
}

if (-not (@($models.models | ForEach-Object { $_.name }) -contains $Model)) {
    if ($CheckOnly) { throw "Ollama is ready, but $Model is missing. Check mode did not download it." }
    $executable = Get-OllamaExecutable
    $env:OLLAMA_HOST = $ServiceUrl
    Write-Host "Downloading missing Ollama model: $Model (first run may take several minutes)..."
    & $executable pull $Model
    if ($LASTEXITCODE -ne 0) { throw "Ollama model download failed: $Model. Run start-all.bat again to retry." }
    $models = Get-OllamaModels
    if (-not $models -or -not (@($models.models | ForEach-Object { $_.name }) -contains $Model)) {
        throw "Ollama did not report $Model as installed after download."
    }
}
Write-Host "Ollama ready: $Model. The API loads the model when a chat request arrives."
