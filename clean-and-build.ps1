#!/usr/bin/env pwsh
# PowerShell script to clean React Native build caches on Windows
# Usage: .\clean-and-build.ps1

param(
    [ValidateSet("quick", "full", "nuclear", "install")]
    [string]$CleanType = "quick",
    [switch]$Build,
    [switch]$Metro
)

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $colors = @{
        "Success" = "Green"
        "Error" = "Red"
        "Warning" = "Yellow"
        "Info" = "Cyan"
    }
    Write-Host $Message -ForegroundColor $colors[$Type]
}

function Stop-Metro {
    Write-Status "🛑 Stopping Metro bundler and Node processes..." "Info"
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $nodeProcesses | Stop-Process -Force
        Write-Status "✅ Node processes stopped" "Success"
        Start-Sleep -Seconds 2
    }
}

function Clean-Watchman {
    Write-Status "🧹 Clearing Watchman cache..." "Info"
    try {
        if (Get-Command watchman -ErrorAction SilentlyContinue) {
            watchman watch-del-all
            Write-Status "✅ Watchman cache cleared" "Success"
        } else {
            Write-Status "⚠️  Watchman not installed (optional)" "Warning"
        }
    } catch {
        Write-Status "⚠️  Could not clear Watchman" "Warning"
    }
}

function Clean-NodeModules {
    Write-Status "🗑️  Removing node_modules..." "Info"
    if (Test-Path "node_modules") {
        Remove-Item -Path "node_modules" -Recurse -Force
        Write-Status "✅ node_modules removed" "Success"
    }
}

function Clean-GradleCache {
    Write-Status "🧹 Clearing Gradle cache..." "Info"
    if (Test-Path "android\.gradle") {
        Remove-Item -Path "android\.gradle" -Recurse -Force
        Write-Status "✅ Gradle cache cleared" "Success"
    }
    if (Test-Path "android\app\build") {
        Remove-Item -Path "android\app\build" -Recurse -Force
        Write-Status "✅ App build directory removed" "Success"
    }
    if (Test-Path "android\build") {
        Remove-Item -Path "android\build" -Recurse -Force
        Write-Status "✅ Android build directory removed" "Success"
    }
}

function Clean-NPMCache {
    Write-Status "🧹 Clearing npm cache..." "Info"
    npm cache clean --force
    Write-Status "✅ npm cache cleared" "Success"
}

function Reinstall-Dependencies {
    Write-Status "📦 Reinstalling dependencies..." "Info"
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Dependencies installed" "Success"
    } else {
        Write-Status "❌ Failed to install dependencies" "Error"
        exit 1
    }
}

function Start-GradleClean {
    Write-Status "🧹 Running Gradle clean..." "Info"
    & android/gradlew.bat clean
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Gradle clean completed" "Success"
    } else {
        Write-Status "❌ Gradle clean failed" "Error"
    }
}

# Main execution
Write-Status "🚀 React Native Clean & Build Script" "Info"
Write-Status "Clean type: $CleanType" "Info"

# Change to mobileapp directory
$mobileAppPath = "c:\Users\fg\Desktop\FECS\mobileapp"
if (-not (Test-Path $mobileAppPath)) {
    Write-Status "❌ Mobile app directory not found: $mobileAppPath" "Error"
    exit 1
}
Set-Location $mobileAppPath
Write-Status "✅ Working directory: $(Get-Location)" "Success"

# Stop Metro first
Stop-Metro

# Execute cleaning based on type
switch ($CleanType) {
    "quick" {
        Write-Status "⚡ Quick clean (Metro cache only)" "Info"
        Clean-Watchman
        npm cache clean --force
    }
    "full" {
        Write-Status "🧹 Full clean (Gradle + npm + watchman)" "Info"
        Clean-Watchman
        Clean-GradleCache
        Clean-NPMCache
        Start-GradleClean
    }
    "nuclear" {
        Write-Status "💣 NUCLEAR CLEAN (Everything)" "Warning"
        Clean-Watchman
        Clean-NodeModules
        Clean-GradleCache
        Clean-NPMCache
        Start-GradleClean
        Reinstall-Dependencies
    }
    "install" {
        Write-Status "📦 Fresh install only" "Info"
        Reinstall-Dependencies
    }
}

# Optionally start Metro server
if ($Metro) {
    Write-Status "🚀 Starting Metro bundler..." "Info"
    Start-Sleep -Seconds 2
    npm start -- --reset-cache
}

# Optionally start build
if ($Build) {
    Write-Status "🔨 Building APK..." "Info"
    Start-Sleep -Seconds 2
    npm run android
}

Write-Status "✅ Cleanup complete!" "Success"
Write-Status "Next steps:" "Info"
Write-Status "  1. npm start -- --reset-cache    (in one terminal)" "Info"
Write-Status "  2. npm run android               (in another terminal)" "Info"
