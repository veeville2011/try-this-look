# Fix MCP Server Path Configuration Script
# This script verifies and fixes npm/npx paths for Shopify MCP server

Write-Host "=== MCP Server Path Configuration Fix ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js installation
Write-Host "1. Checking Node.js installation..." -ForegroundColor Yellow
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if ($nodePath) {
    Write-Host "   ✓ Node.js found: $($nodePath.Source)" -ForegroundColor Green
    $nodeVersion = node --version
    Write-Host "   ✓ Node.js version: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "   ✗ Node.js not found in PATH" -ForegroundColor Red
    exit 1
}

# Check npm installation
Write-Host ""
Write-Host "2. Checking npm installation..." -ForegroundColor Yellow
$npmPath = Get-Command npm -ErrorAction SilentlyContinue
if ($npmPath) {
    Write-Host "   ✓ npm found: $($npmPath.Source)" -ForegroundColor Green
    $npmVersion = npm --version
    Write-Host "   ✓ npm version: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "   ✗ npm not found in PATH" -ForegroundColor Red
    exit 1
}

# Check npx installation
Write-Host ""
Write-Host "3. Checking npx installation..." -ForegroundColor Yellow
$npxPath = Get-Command npx -ErrorAction SilentlyContinue
if ($npxPath) {
    Write-Host "   ✓ npx found: $($npxPath.Source)" -ForegroundColor Green
    $npxVersion = npx --version
    Write-Host "   ✓ npx version: $npxVersion" -ForegroundColor Green
} else {
    Write-Host "   ✗ npx not found in PATH" -ForegroundColor Red
    exit 1
}

# Check system PATH
Write-Host ""
Write-Host "4. Checking system PATH..." -ForegroundColor Yellow
$systemPath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$combinedPath = "$systemPath;$userPath"

$nodejsInPath = $combinedPath -split ';' | Where-Object { $_ -like "*nodejs*" }
if ($nodejsInPath) {
    Write-Host "   ✓ Node.js directory found in PATH:" -ForegroundColor Green
    foreach ($path in $nodejsInPath) {
        Write-Host "     - $path" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ Node.js directory NOT found in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "   To fix this, run as Administrator:" -ForegroundColor Yellow
    Write-Host "   [System.Environment]::SetEnvironmentVariable('Path', [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';C:\Program Files\nodejs', 'Machine')" -ForegroundColor Cyan
}

# Check for incorrect path
Write-Host ""
Write-Host "5. Checking for incorrect npm path..." -ForegroundColor Yellow
$incorrectPath = "C:\Users\$env:USERNAME\node_modules\npm\bin"
if (Test-Path $incorrectPath) {
    Write-Host "   ⚠ Found incorrect path: $incorrectPath" -ForegroundColor Yellow
    Write-Host "   This path should NOT exist. The MCP server is incorrectly looking here." -ForegroundColor Yellow
} else {
    Write-Host "   ✓ Incorrect path does not exist (good)" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Node.js: $($nodePath.Source)" -ForegroundColor White
Write-Host "npm:     $($npmPath.Source)" -ForegroundColor White
Write-Host "npx:     $($npxPath.Source)" -ForegroundColor White
Write-Host ""
Write-Host "=== Recommendations ===" -ForegroundColor Cyan
Write-Host "1. Ensure Cursor is restarted completely after any PATH changes" -ForegroundColor Yellow
Write-Host "2. The MCP server should find npm/npx via system PATH" -ForegroundColor Yellow
Write-Host "3. If issues persist, the MCP server code may need to be updated" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

