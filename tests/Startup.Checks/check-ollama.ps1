$ErrorActionPreference = 'Stop'
$helper = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../scripts/setup-ollama.ps1'))
$fixtureDirectory = Join-Path $env:TEMP ('ragyt-ollama-check-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureDirectory | Out-Null
$fakeCli = Join-Path $fixtureDirectory 'fixture-ollama.ps1'
@'
param($Action, $Model)
if ($Action -ne 'pull') { throw 'Unexpected CLI action' }
$global:RagytOllamaFixture.Pulls++
$global:LASTEXITCODE = 0
if ($global:RagytOllamaFixture.PullFails) { $global:LASTEXITCODE = 9; return }
if (-not $global:RagytOllamaFixture.SkipInstall) { $global:RagytOllamaFixture.Models = @($Model) }
'@ | Set-Content -LiteralPath $fakeCli -Encoding ASCII

function Reset-Fixture([bool]$Ready = $true, [string[]]$Models = @('gemma4:12b')) {
    $global:RagytOllamaFixture = @{ Ready=$Ready; Models=$Models; Starts=0; Pulls=0; PullFails=$false; SkipInstall=$false }
    $global:LASTEXITCODE = 0
}
function Invoke-RestMethod {
    param($Uri, $TimeoutSec)
    if ($Uri -notlike '*/api/tags') { throw 'Unexpected API endpoint' }
    if (-not $global:RagytOllamaFixture.Ready) { throw 'Fixture offline' }
    return [pscustomobject]@{ models = @($global:RagytOllamaFixture.Models | ForEach-Object { [pscustomobject]@{ name = $_ } }) }
}
function Get-Command { param($Name, $ErrorAction) return [pscustomobject]@{ Source=$fakeCli } }
function Get-NetTCPConnection { param($State, $LocalPort, $ErrorAction) return @() }
function Start-Process {
    param($FilePath, $ArgumentList, $WindowStyle, [switch]$PassThru, $RedirectStandardOutput, $RedirectStandardError)
    if ($ArgumentList -ne 'serve' -or $WindowStyle -ne 'Hidden') { throw 'Ollama must start a hidden API service' }
    $global:RagytOllamaFixture.Starts++
    $global:RagytOllamaFixture.Ready = $true
    return [pscustomobject]@{ HasExited=$false }
}
function Stop-Process { throw 'The helper must never stop existing services' }
function Assert([bool]$Value, [string]$Message) { if (-not $Value) { throw $Message } }
function Expect-Failure([scriptblock]$Action) {
    $failed = $false
    try { & $Action } catch { $failed = $true }
    Assert $failed 'Expected setup failure'
}
try {
    Reset-Fixture
    & $helper -ServiceUrl 'http://localhost:11434' -LogDirectory $fixtureDirectory
    Assert ($global:RagytOllamaFixture.Starts -eq 0 -and $global:RagytOllamaFixture.Pulls -eq 0) 'Reuse must not start/pull'
    Reset-Fixture -Ready $false
    & $helper -ServiceUrl 'http://localhost:11434' -LogDirectory $fixtureDirectory
    Assert ($global:RagytOllamaFixture.Starts -eq 1) 'Offline local service must start once'
    Reset-Fixture -Models @()
    & $helper -ServiceUrl 'http://localhost:11434' -LogDirectory $fixtureDirectory
    Assert ($global:RagytOllamaFixture.Pulls -eq 1) 'Missing model must download once'
    Reset-Fixture -Models @()
    Expect-Failure { & $helper -ServiceUrl 'http://localhost:11434' -CheckOnly }
    Assert ($global:RagytOllamaFixture.Starts -eq 0 -and $global:RagytOllamaFixture.Pulls -eq 0) 'Check mode changed services/models'
    Reset-Fixture -Ready $false
    Expect-Failure { & $helper -ServiceUrl 'http://localhost:11434' -CheckOnly }
    Assert ($global:RagytOllamaFixture.Starts -eq 0) 'Offline check started service'
    Reset-Fixture -Ready $false
    Expect-Failure { & $helper -ServiceUrl 'http://ollama.example.test:11434' }
    Assert ($global:RagytOllamaFixture.Starts -eq 0) 'Remote failure started a local service'
    Reset-Fixture -Models @()
    $global:RagytOllamaFixture.PullFails = $true
    Expect-Failure { & $helper -ServiceUrl 'http://localhost:11434' }
    Reset-Fixture -Models @()
    $global:RagytOllamaFixture.SkipInstall = $true
    Expect-Failure { & $helper -ServiceUrl 'http://localhost:11434' }
    Write-Host 'PASS: reuse, hidden startup, missing model download, read-only checks, remote failure, failed/unverified download. All services and CLI calls mocked.'
} finally {
    Remove-Item -LiteralPath $fakeCli -Force
    Remove-Item -LiteralPath $fixtureDirectory
    Remove-Variable -Name RagytOllamaFixture -Scope Global -ErrorAction SilentlyContinue
}
