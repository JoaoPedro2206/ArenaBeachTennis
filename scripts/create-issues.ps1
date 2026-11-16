<#
.SYNOPSIS
  Cria no GitHub as issues descritas em docs/issues/*.md.

.DESCRIPTION
  Cada arquivo começa com um cabeçalho simples:

      ---
      title: "Título da issue"
      labels: feature, backend, P0
      ---
      (corpo em Markdown)

  O script:
    1. cria (ou atualiza) os labels usados, com cor e descrição;
    2. pula issues cujo título já existe (pode rodar de novo sem duplicar);
    3. cria as demais com `gh issue create`.

  Pré-requisitos: GitHub CLI instalado (https://cli.github.com) e autenticado (`gh auth login`).

.PARAMETER Repo
  "dono/repositório". Padrão: o remote `origin` deste projeto.

.PARAMETER DryRun
  Só mostra o que seria criado, sem tocar no GitHub.

.PARAMETER Only
  Números das issues a criar (ex.: -Only 1,6,8). Padrão: todas.

.EXAMPLE
  .\scripts\create-issues.ps1 -DryRun
  .\scripts\create-issues.ps1
  .\scripts\create-issues.ps1 -Only 1,6,8
#>
[CmdletBinding()]
param(
  [string]$Repo,
  [switch]$DryRun,
  [int[]]$Only
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$issuesDir = Join-Path $root 'docs/issues'

# ---------------------------------------------------------------- labels
$labelCatalog = @{
  'feature'       = @('1d76db', 'Nova funcionalidade')
  'bug'           = @('d73a4a', 'Algo não está funcionando')
  'tech-debt'     = @('fbca04', 'Dívida técnica / manutenção')
  'security'      = @('b60205', 'Segurança')
  'infra'         = @('5319e7', 'Infraestrutura, CI/CD e deploy')
  'testes'        = @('0e8a16', 'Testes automatizados')
  'docs'          = @('0075ca', 'Documentação')
  'legal'         = @('c5def5', 'LGPD e questões legais')
  'backend'       = @('bfd4f2', 'API / Node.js / Prisma')
  'frontend'      = @('c2e0c6', 'React / interface')
  'admin'         = @('f9d0c4', 'Painel do dono da arena')
  'ranking'       = @('ff9f1c', 'ELO e rankings')
  'partidas'      = @('2ec4b6', 'Partidas ao vivo e salas')
  'pagamentos'    = @('006b75', 'Cobrança e estornos')
  'autenticação'  = @('d4c5f9', 'Login, sessão e contas')
  'notificações'  = @('fef2c0', 'Push, e-mail e WhatsApp')
  'acessibilidade'= @('7057ff', 'WCAG e usabilidade')
  'produto'       = @('ededed', 'Ideias de produto')
  'P0'            = @('b60205', 'Prioridade máxima: bloqueia o lançamento')
  'P1'            = @('d93f0b', 'Prioridade alta')
  'P2'            = @('fbca04', 'Prioridade média')
}

# ---------------------------------------------------------------- leitura dos arquivos
function Read-Issue([System.IO.FileInfo]$file) {
  $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
  $m = [regex]::Match($raw, '^\s*---\r?\n(?<head>.*?)\r?\n---\r?\n(?<body>.*)$', 'Singleline')
  if (-not $m.Success) { throw "Cabeçalho '---' ausente em $($file.Name)" }

  $title = [regex]::Match($m.Groups['head'].Value, '(?m)^title:\s*"(?<t>.*)"\s*$').Groups['t'].Value
  $labels = [regex]::Match($m.Groups['head'].Value, '(?m)^labels:\s*(?<l>.*?)\s*$').Groups['l'].Value
  if (-not $title) { throw "title ausente em $($file.Name)" }

  [pscustomobject]@{
    Number = [int]($file.Name -replace '^(\d+)-.*$', '$1')
    File   = $file.Name
    Title  = $title
    Labels = @($labels -split '\s*,\s*' | Where-Object { $_ })
    Body   = $m.Groups['body'].Value.Trim()
  }
}

$issues = Get-ChildItem $issuesDir -Filter '*.md' |
  Where-Object { $_.Name -match '^\d{2}-' } |   # ignora o README.md
  Sort-Object Name |
  ForEach-Object { Read-Issue $_ }
if ($Only) { $issues = $issues | Where-Object { $Only -contains $_.Number } }
if (-not $issues) { throw 'Nenhuma issue encontrada.' }

$unknown = $issues.Labels | Sort-Object -Unique | Where-Object { -not $labelCatalog.ContainsKey($_) }
if ($unknown) { Write-Warning "Labels fora do catálogo (serão criados em cinza): $($unknown -join ', ')" }

# ---------------------------------------------------------------- modo simulação
if ($DryRun) {
  Write-Host "`n[SIMULAÇÃO] $($issues.Count) issue(s) seriam criadas:`n" -ForegroundColor Cyan
  foreach ($i in $issues) {
    '{0,2}. {1}' -f $i.Number, $i.Title
    '     labels: {0}   ({1} linhas)' -f ($i.Labels -join ', '), ($i.Body -split "`n").Count
  }
  Write-Host "`nNada foi enviado ao GitHub." -ForegroundColor Cyan
  return
}

# ---------------------------------------------------------------- GitHub
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) não encontrado. Instale em https://cli.github.com e rode 'gh auth login'."
}
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw "gh não está autenticado. Rode: gh auth login" }

if (-not $Repo) {
  $url = (& git -C $root remote get-url origin).Trim()
  $Repo = ($url -replace '^.*github\.com[:/]', '' -replace '\.git$', '')
}
Write-Host "Repositório: $Repo" -ForegroundColor Cyan

# labels
foreach ($name in ($issues.Labels | Sort-Object -Unique)) {
  $c = if ($labelCatalog.ContainsKey($name)) { $labelCatalog[$name] } else { @('cccccc', '') }
  & gh label create $name --repo $Repo --color $c[0] --description $c[1] --force *> $null
}

# títulos já existentes (evita duplicar ao rodar de novo)
$existing = (& gh issue list --repo $Repo --state all --limit 500 --json title | ConvertFrom-Json).title

$created = 0; $skipped = 0
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "issue-body-$PID.md"
try {
  foreach ($i in $issues) {
    if ($existing -contains $i.Title) {
      Write-Host ("= {0,2}. já existe: {1}" -f $i.Number, $i.Title) -ForegroundColor DarkGray
      $skipped++; continue
    }
    [System.IO.File]::WriteAllText($tmp, $i.Body, (New-Object System.Text.UTF8Encoding($false)))
    $url = & gh issue create --repo $Repo --title $i.Title --body-file $tmp --label ($i.Labels -join ',')
    if ($LASTEXITCODE -ne 0) { throw "Falha ao criar a issue $($i.Number)" }
    Write-Host ("+ {0,2}. {1}`n       {2}" -f $i.Number, $i.Title, $url) -ForegroundColor Green
    $created++
    Start-Sleep -Milliseconds 800   # respeita o limite de criação do GitHub
  }
}
finally { Remove-Item $tmp -ErrorAction SilentlyContinue }

Write-Host "`nCriadas: $created · Já existiam: $skipped" -ForegroundColor Cyan
