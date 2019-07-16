# via https://gist.github.com/FeodorFitsner/1056703ec92bd6a3012c15fe78a5e162

Write-Host "Installing Yarn..." -ForegroundColor Cyan

Write-Host "Downloading..."
$msiPath = "$env:TEMP\yarn.msi"
(New-Object Net.WebClient).DownloadFile('https://github.com/yarnpkg/yarn/releases/download/v1.17.3/yarn-1.17.3.msi', $msiPath)

Write-Host "Installing..."
cmd /c start /wait msiexec /i "$msiPath" /quiet

Write-Host "Yarn installed" -ForegroundColor Green
