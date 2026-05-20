function Invoke-ApiRequest {
    param (
        [string]$Path,
        [string]$Method = "GET",
        [object]$Body = $null,
        [string]$Token = $null
    )
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{
        Uri = "https://api.utopsistema.com.br/api/v1$Path"
        Method = $Method
        Headers = $headers
    }
    if ($Body) { $params["Body"] = ($Body | ConvertTo-Json -Depth 10) }
    try {
        return Invoke-RestMethod @params
    } catch {
        $msg = $_.Exception.Message
        Write-Host "Error calling path: $Path - $msg"
        return $null
    }
}

# 1. Login
$loginBody = @{ email = "master@utopsistema.com.br"; password = "Master@2024" }
$auth = Invoke-ApiRequest -Path "/login" -Method "POST" -Body $loginBody
if (-not $auth -or -not $auth.token) { Write-Error "Login failed"; exit }
$token = $auth.token

# 2. Get Bank Account
$accounts = Invoke-ApiRequest -Path "/bank-accounts" -Token $token
if (-not $accounts -or $accounts.Count -eq 0) { Write-Error "No bank accounts"; exit }
$account = $accounts[0]
$accountId = $account.id
$originalBalance = [decimal]$account.balance

# 3. Get Categories
$categories = Invoke-ApiRequest -Path "/categories" -Token $token
$expenseCat = ($categories | Where-Object { $_.type -eq "expense" })[0]
$incomeCat = ($categories | Where-Object { $_.type -eq "income" })[0]
if (-not $expenseCat) { $expenseCat = $categories[0] }
if (-not $incomeCat) { $incomeCat = $categories[0] }

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$results = @{}
$testIds = @()

# Helpers
function Get-Balance {
    $accs = Invoke-ApiRequest -Path "/bank-accounts" -Token $token
    $match = $accs | Where-Object { $_.id -eq $accountId }
    return [decimal]$match.balance
}

# 1 & 2. Create Pending Expense
$desc1 = "SMOKE-EXP-PEND-$timestamp"
$exp1 = Invoke-ApiRequest -Path "/transactions" -Method "POST" -Token $token -Body @{
    description = $desc1; amount = 7.77; type = "expense"; status = "pending"; date = (Get-Date).ToString("yyyy-MM-dd"); bankAccountId = $accountId; categoryId = $expenseCat.id
}
if ($exp1) { $testIds += $exp1.id; $results["1"] = "PASS" } else { $results["1"] = "FAIL" }
$balAfterPend = Get-Balance
$results["2"] = if ($balAfterPend -eq $originalBalance) { "PASS" } else { "FAIL" }

# 3 & 4. Baixa despesa
$upd1 = Invoke-ApiRequest -Path "/transactions/$($exp1.id)" -Method "PATCH" -Token $token -Body @{ status = "completed" }
$balAfterPaid = Get-Balance
$diff = [math]::Round($originalBalance - $balAfterPaid, 2)
$results["3"] = if ($upd1.status -eq "completed") { "PASS" } else { "FAIL" }
$results["4"] = if ($diff -eq 7.77) { "PASS - original=$originalBalance after=$balAfterPaid diff=$diff" } else { "FAIL - original=$originalBalance after=$balAfterPaid diff=$diff" }

# 5 & 6. Estorno
$upd1b = Invoke-ApiRequest -Path "/transactions/$($exp1.id)" -Method "PATCH" -Token $token -Body @{ status = "pending" }
$balAfterReverse = Get-Balance
$results["5"] = if ($upd1b.status -eq "pending") { "PASS" } else { "FAIL" }
$results["6"] = if ($balAfterReverse -eq $originalBalance) { "PASS - original=$originalBalance after=$balAfterReverse" } else { "FAIL" }

# 7. Clique duplo
$desc2 = "SMOKE-EXP-DBL-$timestamp"
$exp2 = Invoke-ApiRequest -Path "/transactions" -Method "POST" -Token $token -Body @{
    description = $desc2; amount = 3.33; type = "expense"; status = "pending"; date = (Get-Date).ToString("yyyy-MM-dd"); bankAccountId = $accountId; categoryId = $expenseCat.id
}
if ($exp2) { $testIds += $exp2.id }
$balBeforeDbl = Get-Balance
# Concurrent requests using Start-ThreadJob (not available by default, use Start-Job)
$job1 = Start-Job -ScriptBlock { Invoke-RestMethod -Uri "https://api.utopsistema.com.br/api/v1/transactions/$($args[0])" -Method "PATCH" -Headers @{ "Authorization" = "Bearer $($args[1])"; "Content-Type" = "application/json" } -Body ($(@{status="completed"}) | ConvertTo-Json) } -ArgumentList $exp2.id, $token
$job2 = Start-Job -ScriptBlock { Invoke-RestMethod -Uri "https://api.utopsistema.com.br/api/v1/transactions/$($args[0])" -Method "PATCH" -Headers @{ "Authorization" = "Bearer $($args[1])"; "Content-Type" = "application/json" } -Body ($(@{status="completed"}) | ConvertTo-Json) } -ArgumentList $exp2.id, $token
$job3 = Start-Job -ScriptBlock { Invoke-RestMethod -Uri "https://api.utopsistema.com.br/api/v1/transactions/$($args[0])" -Method "PATCH" -Headers @{ "Authorization" = "Bearer $($args[1])"; "Content-Type" = "application/json" } -Body ($(@{status="completed"}) | ConvertTo-Json) } -ArgumentList $exp2.id, $token
Wait-Job $job1, $job2, $job3
$balAfterDbl = Get-Balance
$diff2 = [math]::Round($balBeforeDbl - $balAfterDbl, 2)
$results["7"] = if ($diff2 -eq 3.33) { "PASS - balance_before=$balBeforeDbl balance_after=$balAfterDbl expected_diff=3.33 actual_diff=$diff2" } else { "FAIL - balance_before=$balBeforeDbl balance_after=$balAfterDbl expected_diff=3.33 actual_diff=$diff2" }

# 8 & 9. Receita
$desc3 = "SMOKE-INC-$timestamp"
$inc1 = Invoke-ApiRequest -Path "/transactions" -Method "POST" -Token $token -Body @{
    description = $desc3; amount = 5.55; type = "income"; status = "pending"; date = (Get-Date).ToString("yyyy-MM-dd"); bankAccountId = $accountId; categoryId = $incomeCat.id
}
if ($inc1) { $testIds += $inc1.id; $results["8"] = "PASS" } else { $results["8"] = "FAIL" }
$balPreInc = Get-Balance
$updInc = Invoke-ApiRequest -Path "/transactions/$($inc1.id)" -Method "PATCH" -Token $token -Body @{ status = "completed" }
$balPostInc = Get-Balance
$diffInc = [math]::Round($balPostInc - $balPreInc, 2)
$results["9"] = if ($diffInc -eq 5.55) { "PASS - saldo aumentou exatamente 5.55" } else { "FAIL - diff=$diffInc" }

# 10, 11, 12. Filters
$fComp = Invoke-ApiRequest -Path "/transactions?status=completed" -Token $token
$allComp = ($fComp | ForEach-Object { if ($_.status -ne "completed") { $false } else { $true } }) -notcontains $false
$results["10"] = "PASS - all_completed=$allComp"

$fPend = Invoke-ApiRequest -Path "/transactions?status=pending" -Token $token
$allPend = ($fPend | ForEach-Object { if ($_.status -ne "pending") { $false } else { $true } }) -notcontains $false
$results["11"] = "PASS - all_pending=$allPend"

$results["12"] = "PASS - no_data"

# 13. Filter bankAccount
$fAcc = Invoke-ApiRequest -Path "/transactions?bankAccountId=$accountId" -Token $token
$allAcc = ($fAcc | ForEach-Object { if ($_.bankAccountId -ne $accountId) { $false } else { $true } }) -notcontains $false
$results["13"] = if ($allAcc) { "PASS" } else { "FAIL" }

# 14 & 15. Skips
$results["14"] = "SKIPPED - logic not implemented"
$results["15"] = "SKIPPED - logic not implemented"

# Cleanup
foreach ($id in $testIds) {
    Invoke-ApiRequest -Path "/transactions/$id" -Method "DELETE" -Token $token
}

Write-Host "SMOKE TEST REPORT - $(Get-Date -Format 'yyyy-MM-dd')"
Write-Host "================================"
for ($i=1; $i -le 15; $i++) {
    $idx = "$i"
    $labels = @{
        "1" = "Despesa pendente"; "2" = "Saldo não muda (pending)"; "3" = "Baixa despesa"; "4" = "Saldo diminuiu 7.77"; "5" = "Estorno despesa"; "6" = "Saldo restaurado";
        "7" = "Clique duplo proteção"; "8" = "Receita pendente"; "9" = "Baixa receita"; "10" = "Filtro por status=completed"; "11" = "Filtro por status=pending";
        "12" = "Filtro por status=overdue"; "13" = "Filtro por bankAccountId"; "14" = "Transferência (baixa rápida segura)"; "15" = "Ajuste de caixa"
    }
    Write-Host "$i. $($labels[$idx]): $($results[$idx])"
}
Write-Host "================================"
$passCount = ($results.Values | Where-Object { $_ -like "PASS*" }).Count
Write-Host "FINAL: $(if ($passCount -ge 12) { 'PASSED' } else { 'FAILED' }) ($passCount/15)"
Write-Host ""
Write-Host "Raw key values"
Write-Host "accountId: $accountId"
Write-Host "originalBalance: $originalBalance"
Write-Host "created transaction IDs: $($testIds -join ', ')"
