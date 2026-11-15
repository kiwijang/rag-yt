[CmdletBinding()]
param([ValidateSet('auto','gpu','cpu')][string]$Device='auto')
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$null = Get-Command docker.exe -ErrorAction Stop
& docker.exe info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop before preparing MinerU.' }
try { $existing = Invoke-RestMethod 'http://127.0.0.1:8090/health' -TimeoutSec 5 } catch { $existing = $null }
if ($existing -and $existing.busy) { throw 'MinerU is parsing a document. Wait for it to finish before rebuilding/restarting the container.' }
if ($Device -eq 'auto') {
    if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { $Device='gpu' } else { $Device='cpu' }
}
$compose = @('compose','-f',(Join-Path $project 'docker-compose.yml'))
if ($Device -eq 'cpu') { $compose += @('-f',(Join-Path $project 'docker-compose.mineru-cpu.yml')) }
Write-Host "Preparing MinerU Docker service ($Device)..."
& docker.exe @compose up -d --build --wait --wait-timeout 180 mineru
if ($LASTEXITCODE -ne 0) { throw 'MinerU Docker startup failed. See docker compose logs mineru.' }
$health = Invoke-RestMethod 'http://127.0.0.1:8090/health' -TimeoutSec 30
if ($health.engine -ne 'MinerU' -or ($Device -eq 'gpu' -and !$health.cudaAvailable)) { throw 'MinerU health/GPU check failed.' }
Write-Host "MinerU $($health.version) ready; CUDA available: $($health.cudaAvailable)"
Write-Host 'Logs: docker compose logs -f mineru'
