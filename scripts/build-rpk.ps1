param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('build', 'release')]
  [string]$Mode
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Node = (Get-Command node).Source
$Toolkit = Join-Path $Root 'node_modules\aiot-toolkit\lib\bin.js'
$Packager = Join-Path $Root 'scripts\package-rpk.mjs'
$Jsc = Join-Path $Root 'node_modules\@aiot-toolkit\jsc\lib\jsc\win32_aiotjsc.exe'
$BuildDir = Join-Path $Root 'build'
$DistDir = Join-Path $Root 'dist'
$ManifestPath = Join-Path $Root 'src\manifest.json'

if (-not (Test-Path -LiteralPath $Toolkit)) {
  throw "aiot-toolkit not found: $Toolkit"
}
if (-not (Test-Path -LiteralPath $Jsc)) {
  throw "aiotjsc not found: $Jsc"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$artifactMode = if ($Mode -eq 'build') { 'debug' } else { 'release' }
$otherMode = if ($Mode -eq 'build') { 'release' } else { 'debug' }
$artifactName = "$($manifest.package).$artifactMode.$($manifest.versionName).rpk"
$artifactPath = Join-Path $DistDir $artifactName
$otherArtifactPath = Join-Path $DistDir "$($manifest.package).$otherMode.$($manifest.versionName).rpk"
$preservedArtifact = $null
if (Test-Path -LiteralPath $otherArtifactPath) {
  $preservedArtifact = [System.IO.File]::ReadAllBytes($otherArtifactPath)
}

Push-Location $Root
try {
  & $Node $Toolkit $Mode --drop-console false
  if ($LASTEXITCODE -ne 0) {
    throw "aiot $Mode failed with exit code $LASTEXITCODE"
  }

  & $Jsc -ms $BuildDir
  if ($LASTEXITCODE -ne 0) {
    throw "aiotjsc failed with exit code $LASTEXITCODE"
  }

  $jsFiles = Get-ChildItem -LiteralPath $BuildDir -Recurse -File -Filter '*.js'
  foreach ($file in $jsFiles) {
    $compiled = [System.IO.Path]::ChangeExtension($file.FullName, '.jsc')
    if (-not (Test-Path -LiteralPath $compiled)) {
      throw "Missing JSC output for $($file.FullName)"
    }
  }
  foreach ($file in $jsFiles) {
    Remove-Item -LiteralPath $file.FullName -Force
  }

  & $Node $Packager $Mode
  if ($LASTEXITCODE -ne 0) {
    throw "signed RPK packaging failed with exit code $LASTEXITCODE"
  }
  if ($null -ne $preservedArtifact) {
    [System.IO.File]::WriteAllBytes($otherArtifactPath, $preservedArtifact)
  }
  Write-Output "RPK ready: $artifactPath"
}
finally {
  Pop-Location
}
