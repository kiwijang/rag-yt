Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 otherwise decodes native UTF-8 output using the console code page.
$OutputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
function Invoke-BackupDocker {
    param([string[]]$DockerArguments)
    $output = & docker @DockerArguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed: $output" }
    return $output
}
function Invoke-BackupSql {
    param([string]$Container, [string]$User, [string]$Database, [string]$Sql)
    $output = $Sql | & docker exec -e PGCLIENTENCODING=UTF8 -i $Container psql -X -U $User -d $Database -v ON_ERROR_STOP=1 -At -F '|'
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL command failed.' }
    return $output
}
function Assert-BackupTarget {
    param([string]$Container, [string]$Database, [string]$User)
    foreach ($value in @($Container,$Database,$User)) {
        if ($value -notmatch '^[A-Za-z0-9_][A-Za-z0-9_.-]*$') { throw 'Invalid target name.' }
    }
    if ((Invoke-BackupSql $Container $User $Database 'SELECT current_database();') -ne $Database) { throw 'Database identity mismatch.' }
}
