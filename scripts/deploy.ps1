# Copies the built plugin into Tabby's plugin directory.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
if (-not (Test-Path (Join-Path $dist 'index.js'))) {
    Write-Error "dist/index.js not found - run 'npm run build' first."
}

$dest = Join-Path $env:APPDATA 'tabby\plugins\node_modules\tabby-pane-titles'
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item (Join-Path $root 'package.json') $dest -Force
New-Item -ItemType Directory -Force (Join-Path $dest 'dist') | Out-Null
Copy-Item (Join-Path $dist '*') (Join-Path $dest 'dist') -Recurse -Force

Write-Host "Deployed to $dest"
Write-Host 'Restart Tabby to load the plugin.'
