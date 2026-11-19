[CmdletBinding()]
param([ValidateSet('auto','gpu','cpu')][string]$Device='auto')
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
try { $existing=Invoke-RestMethod 'http://127.0.0.1:8091/health' -TimeoutSec 5 } catch { $existing=$null }
if ($existing -and $existing.busy) { throw 'Embedding inference is busy. Wait for indexing/search to finish before restarting it.' }
if ($Device -eq 'auto') { if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { $Device='gpu' } else { $Device='cpu' } }
$compose=@('compose','-f',(Join-Path $project 'docker-compose.yml'))
if ($Device -eq 'cpu') { $compose+=@('-f',(Join-Path $project 'docker-compose.mineru-cpu.yml')) }
& docker.exe @compose up -d --build --wait --wait-timeout 180 embedding weaviate
if ($LASTEXITCODE -ne 0) { throw 'Embedding/Weaviate startup failed. See docker compose logs embedding weaviate.' }
$health=Invoke-RestMethod 'http://127.0.0.1:8091/health' -TimeoutSec 15
if ($Device -eq 'gpu' -and !$health.cudaAvailable) { throw 'Embedding CUDA health check failed.' }
Write-Host "BGE-M3 / Jina CLIP v2 ready. CUDA: $($health.cudaAvailable). Models download on first use."
