$files = Get-ChildItem -Path "e:\experiments\workspace\web-dev\telegram_casso\src" -Recurse -Filter "*.spec.js"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Convert import statements to require
    $content = $content -replace 'import\s+(\{[^}]+\}|\w+)\s+from\s+[''"]([^''\"]+)[''"];?', 'const $1 = require(''$2'');'
    
    # Convert default exports to module.exports
    $content = $content -replace 'export\s+default\s+', 'module.exports = '
    
    # Save the converted content
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
    Write-Host "Converted: $($file.FullName)"
}
