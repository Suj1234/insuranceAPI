$env:DATABASE_URL = "postgresql://neondb_owner:npg_vzfCZ5YWO9js@ep-tiny-fire-atvlw9ds-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:GEE_KEY_FILE  = "gee-key.json"
$env:GEE_PROJECT   = "insuretech-data-platform"

$log = "gsw_extraction.log"
$ts  = { "[$(Get-Date -Format 'HH:mm:ss')]" }

function Run-Script($script) {
    & $ts | Tee-Object -FilePath $log -Append | Write-Host
    Write-Host "=== START: $script ===" | Tee-Object -FilePath $log -Append
    python $script 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -ne 0) {
        "=== FAILED: $script (exit $LASTEXITCODE) ===" | Tee-Object -FilePath $log -Append | Write-Host
    } else {
        "=== DONE: $script ===" | Tee-Object -FilePath $log -Append | Write-Host
    }
}

Run-Script "scripts/extract_gsw_main.py"
Run-Script "scripts/extract_gsw_yearly.py"
Run-Script "scripts/extract_gsw_monthly.py"

"=== ALL DONE $(Get-Date) ===" | Tee-Object -FilePath $log -Append | Write-Host
