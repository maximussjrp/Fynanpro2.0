# Script para corrigir useAuth em todas as páginas do dashboard

$dashboardPages = @(
    "src\app\dashboard\bank-accounts\page.tsx",
    "src\app\dashboard\budgets\page.tsx",
    "src\app\dashboard\calendar\page.tsx",
    "src\app\dashboard\categories\page.tsx",
    "src\app\dashboard\installments\page.tsx",
    "src\app\dashboard\payment-methods\page.tsx",
    "src\app\dashboard\recurring-bills\page.tsx",
    "src\app\dashboard\reports\page.tsx",
    "src\app\dashboard\transactions\page.tsx"
)

foreach ($file in $dashboardPages) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        
        # Adiciona useAuth no nível do componente se ainda não tiver
        if ($content -match "export default function \w+\(\) \{") {
            $content = $content -replace "(export default function \w+\(\) \{`r?`n  const router = useRouter\(\);)", "`$1`n  const { accessToken } = useAuth();"
        }
        
        # Substitui const { accessToken: token } = useAuth(); por const token = accessToken;
        $content = $content -replace "const \{ accessToken: token \} = useAuth\(\);", "const token = accessToken;"
        
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "✅ Fixed: $file"
    }
}

Write-Host "`n✅ Todos os arquivos corrigidos!"
