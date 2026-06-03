# Google Cloud SDK 설치 스크립트 (Windows PowerShell)

Write-Host "=== Google Cloud SDK 설치 ===" -ForegroundColor Green

# 다운로드 URL
$installerUrl = "https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe"
$installerPath = "$env:TEMP\GoogleCloudSDKInstaller.exe"

Write-Host "`n다운로드 중..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath

Write-Host "`n설치 프로그램 실행 중..." -ForegroundColor Yellow
Write-Host "설치 창이 열리면 다음을 선택하세요:" -ForegroundColor Cyan
Write-Host "1. 기본 경로에 설치" -ForegroundColor White
Write-Host "2. 'Start Cloud SDK Shell' 체크" -ForegroundColor White
Write-Host "3. 'Run gcloud init' 체크 해제 (나중에 수동으로 실행)" -ForegroundColor White

Start-Process -FilePath $installerPath -Wait

Write-Host "`n설치 완료!" -ForegroundColor Green
Write-Host "`n다음 명령어를 실행하여 설치를 확인하세요:" -ForegroundColor Cyan
Write-Host "gcloud version" -ForegroundColor White
