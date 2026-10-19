$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$extensionRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'research-ext'))
$assetRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'assets/extensions'))
if (-not $extensionRoot.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar) -or -not $assetRoot.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected packaging paths' }
New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null
$contents = @(Get-ChildItem -LiteralPath $extensionRoot | Where-Object { $_.Name -notin @('node_modules','tests','.git') } | ForEach-Object { $_.FullName })
Compress-Archive -LiteralPath $contents -DestinationPath (Join-Path $assetRoot 'n360-industry-news-clipper.zip') -Force
Write-Output 'N360 Industry News Clipper ZIP packaged.'
