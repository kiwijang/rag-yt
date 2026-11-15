[CmdletBinding()]
param(
    [string]$BackupRoot,
    [ValidateSet('manual','scheduled','pre-migration')][string]$Reason = 'manual'
)
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
    $BackupRoot = Join-Path $PSScriptRoot '../../backups'
}
$ErrorActionPreference = 'Stop'
try {
    $path = & "$PSScriptRoot/Backup-Local.ps1" -BackupRoot $BackupRoot -Reason $Reason
    & "$PSScriptRoot/Test-Backup.ps1" -BackupPath $path
    Write-Host "Verified backup: $path"
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
