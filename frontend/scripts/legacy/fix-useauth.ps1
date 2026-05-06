# Script para corrigir import e uso de useAuth em todas as páginas

$files = Get-ChildItem -Path "src\app\dashboard" -Filter "*.tsx" -Recurse | Where-Object { $_.FullName -match "page\.tsx$" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Verifica se tem useAuth.getState()
    if ($content -match "useAuth\.getState\(\)\.accessToken") {
        # Adiciona import se não existir
        if ($content -notmatch "import.*useAuth.*from.*stores/auth") {
            $content = $content -replace "('use client';)", "`$1`nimport { useAuth } from '@/stores/auth';"
            $modified = $true
        }
        
        # Substitui todas as ocorrências de useAuth.getState().accessToken
        $content = $content -replace "const token = useAuth\.getState\(\)\.accessToken;", "const { accessToken: token } = useAuth();"
        $modified = $true
        
        if ($modified) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            Write-Host "✅ Fixed: $($file.Name)"
        }
    }
}

Write-Host "`n✅ Todas as páginas corrigidas!"
