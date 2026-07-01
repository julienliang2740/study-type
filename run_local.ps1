$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$processes = New-Object System.Collections.Generic.List[System.Diagnostics.Process]

function Start-TypeStudyService {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,
    [Parameter(Mandatory = $true)]
    [string] $WorkingDirectory,
    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  Write-Host "starting $Name"
  $process = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -PassThru

  $processes.Add($process)
}

function Stop-TypeStudyServices {
  Write-Host ""
  Write-Host "stopping local type-study services..."

  foreach ($process in $processes) {
    try {
      if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
      }
    } catch {
      # Process may already have exited.
    }
  }
}

try {
  Start-TypeStudyService `
    -Name "process_input worker on http://127.0.0.1:8788" `
    -WorkingDirectory (Join-Path $rootDir "backend/process_input") `
    -Arguments @("run", "dev:worker")

  Start-TypeStudyService `
    -Name "normalization worker on http://127.0.0.1:8789" `
    -WorkingDirectory (Join-Path $rootDir "backend/normalization") `
    -Arguments @("run", "dev")

  Start-TypeStudyService `
    -Name "frontend on http://127.0.0.1:5173" `
    -WorkingDirectory $rootDir `
    -Arguments @("run", "dev")

  Write-Host ""
  Write-Host "local services are starting:"
  Write-Host "  frontend:      http://127.0.0.1:5173"
  Write-Host "  process_input: http://127.0.0.1:8788"
  Write-Host "  normalization: http://127.0.0.1:8789"
  Write-Host ""
  Write-Host "press Ctrl+C or close this window to stop all services"

  while ($true) {
    Start-Sleep -Seconds 1

    foreach ($process in $processes) {
      if ($process.HasExited) {
        throw "A local service exited unexpectedly. Process id: $($process.Id)"
      }
    }
  }
} finally {
  Stop-TypeStudyServices
}
