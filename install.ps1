$ErrorActionPreference = 'Stop'

$Repo = "Nabwinsaud/terminal-chat"
$Arch = $env:PROCESSOR_ARCHITECTURE

if ($Arch -eq "AMD64") {
    $BinaryArch = "x64"
} elseif ($Arch -eq "ARM64") {
    $BinaryArch = "arm64"
} else {
    Write-Error "Unsupported architecture: $Arch"
    exit 1
}

$BinaryName = "terminal-chat-windows-$BinaryArch.exe"
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$BinaryName"
$InstallDir = "$env:LOCALAPPDATA\Programs\terminal-chat"
$ExePath = "$InstallDir\terminal-chat.exe"

Write-Host "Downloading Terminal Chat..."
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

Invoke-WebRequest -Uri $DownloadUrl -OutFile $ExePath

# Add to PATH if not present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    Write-Host "Adding to PATH..."
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    $env:Path += ";$InstallDir"
}

Write-Host "Success! Run 'terminal-chat' to start."
