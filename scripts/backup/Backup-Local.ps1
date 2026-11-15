[CmdletBinding()]
param(
    [string]$BackupRoot,
    [string]$Container = 'ragyt-postgres', [string]$Database = 'ragyt', [string]$User = 'ragyt',
    [ValidateSet('manual','scheduled','pre-migration')][string]$Reason = 'manual'
)
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
    $BackupRoot = Join-Path $PSScriptRoot '../../backups'
}
. "$PSScriptRoot/Common.ps1"
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$BackupRoot = [IO.Path]::GetFullPath($BackupRoot)
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$lock = [IO.File]::Open((Join-Path $BackupRoot '.backup.lock'), 'OpenOrCreate','ReadWrite','None')
$id = 'ragyt-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$folder = Join-Path $BackupRoot $id
$remote = "/tmp/$id.dump"
try {
    Assert-BackupTarget $Container $Database $User
    New-Item -ItemType Directory -Path $folder | Out-Null
    Write-Host "Backing up database $Database in $Container..."
    $started = [DateTime]::UtcNow.ToString('o')
    $null = Invoke-BackupDocker @('exec',$Container,'pg_dump','-U',$User,'-d',$Database,'--format=custom',"--file=$remote")
    $null = Invoke-BackupDocker @('cp',"${Container}:$remote",(Join-Path $folder 'database.dump'))
    $null = Invoke-BackupDocker @('exec',$Container,'pg_restore','--list',$remote)
    $uploads = Join-Path $projectRoot 'Rag.Api/uploads/pdf'
    $files = Join-Path $folder 'pdf'
    New-Item -ItemType Directory -Path $files | Out-Null
    if (Test-Path -LiteralPath $uploads) {
        Get-ChildItem -LiteralPath $uploads -Recurse | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | ForEach-Object { throw 'PDF upload tree contains a link; refusing to follow it during backup.' }
        Get-ChildItem -LiteralPath $uploads -Recurse -File | ForEach-Object {
            $relative = $_.FullName.Substring($uploads.Length + 1)
            $destination = Join-Path $files $relative
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $destination
        }
    }
    Copy-Item -LiteralPath (Join-Path $projectRoot 'Rag.Api/Data/Migrations') -Destination (Join-Path $folder 'migrations') -Recurse
    $version = Invoke-BackupSql $Container $User $Database 'SHOW server_version;'
    $history = @(Invoke-BackupSql $Container $User $Database 'SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";')
    $hashes = @(Get-ChildItem -LiteralPath $folder -Recurse -File | ForEach-Object {
        [ordered]@{ path=$_.FullName.Substring($folder.Length+1).Replace('\','/'); bytes=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
    })
    [ordered]@{ formatVersion=1; id=$id; database=$Database; container=$Container; user=$User;
        startedUtc=$started; finishedUtc=[DateTime]::UtcNow.ToString('o'); serverVersion="$version";
        reason=$Reason; migrationHistory=$history; files=$hashes;
        scope='Application PostgreSQL database, uploaded PDFs and migration source; no secrets/config or vector-store backup.';
        consistency='pg_dump snapshot; uploaded PDF completeness requires Test-Backup. Avoid concurrent PDF delete/replacement.' } |
        ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $folder 'manifest.json') -Encoding UTF8
    [ordered]@{ completedUtc=[DateTime]::UtcNow.ToString('o'); manifestSha256=(Get-FileHash (Join-Path $folder 'manifest.json')).Hash } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $folder 'complete.json') -Encoding UTF8
    Write-Output $folder
} catch {
    if (Test-Path -LiteralPath $folder) { $_.Exception.Message | Set-Content (Join-Path $folder 'FAILED.txt') -Encoding UTF8 }
    throw
} finally {
    & docker exec $Container rm -f -- $remote 2>$null | Out-Null
    $lock.Dispose()
}
