# PowerShell script to kill all processes using port 3001
Write-Host "Checking for processes using port 3001..." -ForegroundColor Yellow

$processes = netstat -ano | Select-String ":3001" | ForEach-Object {
    $line = $_.Line.Trim()
    if ($line -match '\s+(\d+)\s*$') {
        $pid = $matches[1]
        Write-Host "Found process PID: $pid" -ForegroundColor Cyan
        $pid
    }
}

if ($processes) {
    $uniquePids = $processes | Sort-Object -Unique
    Write-Host "`nKilling processes: $($uniquePids -join ', ')" -ForegroundColor Red
    
    foreach ($pid in $uniquePids) {
        try {
            taskkill /F /PID $pid 2>&1 | Out-Null
            Write-Host "✓ Killed process $pid" -ForegroundColor Green
        } catch {
            Write-Host "✗ Failed to kill process $pid : $_" -ForegroundColor Red
        }
    }
    
    Write-Host "`nVerifying port 3001 is free..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
    $remaining = netstat -ano | Select-String ":3001"
    if ($remaining) {
        Write-Host "⚠ Warning: Port 3001 is still in use!" -ForegroundColor Red
    } else {
        Write-Host "✓ Port 3001 is now free!" -ForegroundColor Green
    }
} else {
    Write-Host "No processes found using port 3001" -ForegroundColor Green
}

