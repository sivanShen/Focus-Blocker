param(
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId
)

# This script requires Administrator privileges.
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Please run this script as Administrator." -ForegroundColor Red
    Pause
    Exit
}

$RegistryPath = "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"

if (-not (Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
}

$Value = "${ExtensionId};https://clients2.google.com/service/update2/crx"

New-ItemProperty -Path $RegistryPath -Name "1" -Value $Value -PropertyType String -Force | Out-Null

Write-Host "Success! The extension has been locked." -ForegroundColor Green
Write-Host "To unlock it, you must delete this registry key." -ForegroundColor Yellow
Pause
