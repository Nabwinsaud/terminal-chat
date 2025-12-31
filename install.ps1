$ErrorActionPreference = 'Stop'

$Repo = "Nabwinsaud/terminal-chat"
$Arch = $env:PROCESSOR_ARCHITECTURE

if ($Arch -eq "AMD64") {
    $BinaryArch = "x64"
} elseif ($Arch -eq "ARM64") {
    Write-Host "ARM64 detected. Using x64 binary via emulation."
    $BinaryArch = "x64"
} else {
    Write-Error "Unsupported architecture: $Arch"
    exit 1
}

$BinaryName = "terminal-chat-windows-$BinaryArch.exe"
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$BinaryName"
$InstallDir = "$env:LOCALAPPDATA\Programs\terminal-chat"
$ExePath = "$InstallDir\terminal-chat.exe"

if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

if (Test-Path $ExePath) {
    Write-Host "Updating existing installation..."
} else {
    Write-Host "Downloading Terminal Chat..."
}

$ProgressPreference = 'SilentlyContinue'
$job = Start-Job -ScriptBlock {
    param($url, $out)
    Invoke-WebRequest -Uri $url -OutFile $out
} -ArgumentList $DownloadUrl, $ExePath

$tempFile = "$env:TEMP\terminal-chat-progress.tmp"
while ($job.State -eq 'Running') {
    if (Test-Path $ExePath) {
        $downloaded = (Get-Item $ExePath).Length / 1MB
        Write-Progress -Activity "Downloading" -Status ("{0:N2} MB downloaded" -f $downloaded) -PercentComplete -1
    }
    Start-Sleep -Milliseconds 200
}

Receive-Job $job
Remove-Job $job
Write-Progress -Activity "Downloading" -Completed
$ProgressPreference = 'Continue'

# Add to PATH if not present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    Write-Host "Adding to PATH..."
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    $env:Path += ";$InstallDir"
}

Write-Host "Success! Run 'terminal-chat' to start."
