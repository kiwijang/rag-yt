[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BackupPath, [string]$Container='ragyt-postgres', [string]$User='ragyt')
. "$PSScriptRoot/Common.ps1"
$BackupPath = [IO.Path]::GetFullPath($BackupPath)
$marker = Get-Content -LiteralPath (Join-Path $BackupPath 'complete.json') -Raw | ConvertFrom-Json
if ((Get-FileHash (Join-Path $BackupPath 'manifest.json')).Hash -ne $marker.manifestSha256) { throw 'Manifest checksum mismatch.' }
$manifest = Get-Content -LiteralPath (Join-Path $BackupPath 'manifest.json') -Raw | ConvertFrom-Json
foreach ($file in $manifest.files) {
    $path = [IO.Path]::GetFullPath((Join-Path $BackupPath $file.path))
    if (!$path.StartsWith($BackupPath + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path outside backup.' }
    if ((Get-FileHash -LiteralPath $path).Hash -ne $file.sha256) { throw "Checksum mismatch: $($file.path)" }
}
Assert-BackupTarget $Container 'postgres' $User
$name = 'ragyt_restorecheck_' + [Guid]::NewGuid().ToString('N')
$remote = "/tmp/$name.dump"
$created = $false
try {
    $null = Invoke-BackupDocker @('cp',(Join-Path $BackupPath 'database.dump'),"${Container}:$remote")
    $null = Invoke-BackupSql $Container $User 'postgres' "CREATE DATABASE $name TEMPLATE template0;"
    $created = $true
    $null = Invoke-BackupDocker @('exec',$Container,'pg_restore','-U',$User,'-d',$name,'--exit-on-error','--single-transaction','--no-owner','--no-acl',$remote)
    $schemaCheck = Invoke-BackupSql $Container $User $name @'
SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='YoutubeTranscripts' AND column_name IN ('DownloadSeconds','ProcessingSeconds','TranscriptionSeconds','TranslationSeconds');
'@
    if ($schemaCheck -ne '4') { throw 'Required transcript timing columns missing.' }
    $history = @(Invoke-BackupSql $Container $User $name 'SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";')
    if ($history -notcontains '20261114105612_RecordYoutubeTranscriptTiming') { throw 'Timing migration missing.' }
    $stats = @(Invoke-BackupSql $Container $User $name @'
SELECT 'YoutubeTranscripts',count(*) FROM "YoutubeTranscripts"
UNION ALL SELECT 'YoutubeTranscriptSegments',count(*) FROM "YoutubeTranscriptSegments"
UNION ALL SELECT 'RagDocumentChunks',count(*) FROM "RagDocumentChunks"
UNION ALL SELECT 'PdfSources',count(*) FROM "PdfSources"
UNION ALL SELECT 'TranscriptTimingRows',count(*) FROM "YoutubeTranscripts" WHERE "ProcessingSeconds" IS NOT NULL;
'@)
    # ASCII transport avoids console-code-page corruption of Chinese filenames.
    $encodedPdfs = @(Invoke-BackupSql $Container $User $name 'SELECT encode(convert_to("FileName", ''UTF8''), ''hex'') FROM "PdfSources" WHERE "FileName" IS NOT NULL AND "FileName" <> '''';')
    $pdfs = @($encodedPdfs | ForEach-Object {
        $hex = [string]$_
        if ($hex -notmatch '^(?:[0-9a-fA-F]{2})+$') { throw 'Invalid encoded PDF filename.' }
        $bytes = New-Object byte[] ($hex.Length / 2)
        for ($i = 0; $i -lt $bytes.Length; $i++) { $bytes[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2),16) }
        [Text.Encoding]::UTF8.GetString($bytes)
    })
    $missing = @($pdfs | Where-Object { [IO.Path]::GetFileName($_) -ne $_ -or !(Test-Path -LiteralPath (Join-Path (Join-Path $BackupPath 'pdf') $_) -PathType Leaf) })
    if ($missing.Count) { throw "PDF files missing from backup ($($missing.Count)): $($missing -join ', '). Restore test is not complete." }
    [ordered]@{ status='passed'; testedUtc=[DateTime]::UtcNow.ToString('o'); isolatedDatabase=$name;
        manifestSha256=$marker.manifestSha256; rowCounts=$stats; migrationHistory=$history; uploadedPdfFiles=$pdfs.Count } |
        ConvertTo-Json -Depth 6 | Set-Content (Join-Path $BackupPath 'restore-test.json') -Encoding UTF8
    Write-Host 'PASS: archive restored in isolated database; schema, timing history and PDF files verified.'
    $stats | Write-Host
} finally {
    # No caller-supplied restore target; only delete the database created in this invocation.
    if ($created -and $name -match '^ragyt_restorecheck_[a-f0-9]{32}$') {
        $null = Invoke-BackupSql $Container $User 'postgres' "DROP DATABASE $name;"
    }
    & docker exec $Container rm -f -- $remote 2>$null | Out-Null
}
