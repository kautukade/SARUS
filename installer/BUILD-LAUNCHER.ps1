param([string]$OutputPath = '')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if (-not $OutputPath) { $OutputPath = Join-Path $Root 'SARUS.exe' }
$source = Join-Path $PSScriptRoot 'JubiLauncher.cs'
$compiler = @(
    (Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:SystemRoot 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) { throw 'The Windows .NET Framework C# compiler is required to build the Jubi launcher.' }
if (-not (Test-Path -LiteralPath $source)) { throw 'JubiLauncher.cs is missing.' }
$parent = Split-Path -Parent $OutputPath
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ /reference:System.Windows.Forms.dll "/out:$OutputPath" $source
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $OutputPath)) { throw 'Jubi launcher compilation failed.' }
Write-Output "Jubi launcher compiled from source: $OutputPath"
