$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$assetRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'assets/extensions'))
if (-not $assetRoot.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected asset path' }
New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null
foreach ($package in @(
  @{ Folder = 'tma-ext'; Prefix = 'news-extension'; Name = 'n360-news-clipper'; Files = @('manifest.json','README.md','contentScript.js','locationMatching.js','shared.js','options.html','options.js','popup.html','popup.js','sidepanel.html','sidepanel.js','styles') },
  @{ Folder = 'research-ext'; Prefix = 'research-extension'; Name = 'n360-industry-news-clipper'; Files = @('manifest.json','README.md','contentScript.js','journals.json','shared.js','options.html','options.js','popup.html','popup.js','style.css') }
)) {
  $extensionRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $package.Folder))
  if (-not $extensionRoot.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected extension path' }
  $stagingRoot = Join-Path $projectRoot ('.test-artifacts/package-' + [guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path (Join-Path $stagingRoot 'images') | Out-Null
  foreach ($file in $package.Files) { Copy-Item -LiteralPath (Join-Path $extensionRoot $file) -Destination $stagingRoot -Recurse }
  foreach ($size in @(16,32,48,128)) { Copy-Item -LiteralPath (Join-Path $extensionRoot ('images/' + $package.Prefix + '-' + $size + '.png')) -Destination (Join-Path $stagingRoot 'images') }
  Compress-Archive -LiteralPath @(Get-ChildItem -LiteralPath $stagingRoot | ForEach-Object { $_.FullName }) -DestinationPath (Join-Path $assetRoot ($package.Name + '.zip')) -Force
  Write-Output ($package.Name + ' packaged; staging folder: ' + $stagingRoot)
}
