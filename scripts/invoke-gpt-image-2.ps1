[CmdletBinding(DefaultParameterSetName = "Prompt")]
param(
  [Parameter(ParameterSetName = "Prompt", Mandatory = $true)]
  [string]$Prompt,

  [Parameter(ParameterSetName = "Clipboard", Mandatory = $true)]
  [switch]$PromptFromClipboard,

  [string]$LeadId,
  [string[]]$Ref = @(),
  [string]$Out,
  [int]$TimeoutSec = 300,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Convert-ToBashPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  $absolute = [System.IO.Path]::GetFullPath($Path)
  if ($absolute -match '^(?<drive>[A-Za-z]):\\(?<rest>.*)$') {
    $drive = $Matches.drive.ToLowerInvariant()
    $rest = $Matches.rest -replace '\\', '/'
    return "/$drive/$rest"
  }

  return $absolute -replace '\\', '/'
}

function Get-AbsolutePath {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (Test-Path -LiteralPath $Path) {
    return (Resolve-Path -LiteralPath $Path).Path
  }

  return [System.IO.Path]::GetFullPath($Path)
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$skillRoot = Join-Path $HOME ".agents\skills\gpt-image-2"
$generatorScript = Join-Path $skillRoot "scripts\gen.sh"

if (-not (Test-Path -LiteralPath $generatorScript)) {
  throw "gpt-image-2 skill was not found at '$generatorScript'. Install the skill first."
}

if ($PromptFromClipboard) {
  $Prompt = Get-Clipboard
}

if ([string]::IsNullOrWhiteSpace($Prompt)) {
  throw "Prompt is empty. Copy the lead prompt first or pass -Prompt explicitly."
}

$bash = Get-Command bash -ErrorAction SilentlyContinue
$python = Get-Command python3 -ErrorAction SilentlyContinue
$codex = Get-Command codex -ErrorAction SilentlyContinue

if ([string]::IsNullOrWhiteSpace($Out)) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $outputDir = Join-Path $repoRoot "tmp\gpt-image-2"
  if (-not [string]::IsNullOrWhiteSpace($LeadId)) {
    $outputDir = Join-Path $outputDir "lead-$LeadId"
  }

  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  $Out = Join-Path $outputDir "image-$timestamp.png"
} else {
  $outputDir = Split-Path -Parent $Out
  if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  }
  $Out = Get-AbsolutePath $Out
}

$resolvedRefs = @()
foreach ($item in $Ref) {
  if (-not (Test-Path -LiteralPath $item)) {
    throw "Reference image not found: $item"
  }

  $resolvedRefs += (Resolve-Path -LiteralPath $item).Path
}

$bashArgs = @(
  (Convert-ToBashPath $generatorScript),
  "--prompt",
  $Prompt,
  "--out",
  (Convert-ToBashPath $Out),
  "--timeout-sec",
  "$TimeoutSec"
)

foreach ($item in $resolvedRefs) {
  $bashArgs += "--ref"
  $bashArgs += (Convert-ToBashPath $item)
}

$missing = @()
if (-not $bash) { $missing += "bash" }
if (-not $python) { $missing += "python3" }
if (-not $codex) { $missing += "codex" }

if ($DryRun) {
  Write-Host "Repo root: $repoRoot"
  Write-Host "Skill root: $skillRoot"
  Write-Host "Output path: $Out"
  if ($resolvedRefs.Count -gt 0) {
    Write-Host "Reference count: $($resolvedRefs.Count)"
  }
  if ($missing.Count -gt 0) {
    Write-Warning ("Missing prerequisites: " + ($missing -join ", "))
  } else {
    Write-Host "All local prerequisites were found."
  }
  Write-Host "Dry run only. Remove -DryRun to execute GPT Image 2." 
  return
}

if (-not $bash) {
  throw "bash was not found. Install Git Bash or a compatible bash executable first."
}

if (-not $python) {
  throw "python3 was not found. Install Python 3 first."
}

if (-not $codex) {
  throw "codex was not found. Install Codex CLI and run 'codex login' before using GPT Image 2."
}

& $bash.Source @bashArgs