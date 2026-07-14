@echo off
rem Firma Yonetim Paneli - URETIM (production) modu baslatma betigi.
rem Ag uzerinden (baska bilgisayarlardan) test icin bunu kullanin:
rem   - HMR WebSocket hatasi olmaz, daha stabil ve hizlidir.
rem   - Sunucu 0.0.0.0 dinler; ayni agdaki diger PC'ler http://<bu-pc-ip>:3000 ile baglanir.
rem Not: Turkce ozel karakter kullanilmiyor (cmd.exe UTF-8 bat'i yanlis ayristirir).
title Firma Yonetim Paneli (Uretim)
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%PATH%"

echo.
echo  Firma Yonetim Paneli - URETIM MODU
echo  ==================================

rem Sunucu zaten calisiyorsa yeniden baslatma
netstat -ano | findstr /C:":3000 " | findstr LISTENING >nul
if %errorlevel%==0 (
    echo  Sunucu zaten calisiyor, tarayici aciliyor...
    start "" http://localhost:3000
    goto ipgoster
)

rem PostgreSQL servisi normalde otomatik calisir; kapaliysa baslatmayi dene
netstat -ano | findstr /C:":5432 " | findstr LISTENING >nul
if not %errorlevel%==0 (
    echo  PostgreSQL servisi baslatiliyor...
    net start postgresql-x64-17 >nul 2>&1
)

echo  Uygulama derleniyor (ilk sefer birkac dakika surebilir)...
call npm run build
if errorlevel 1 (
    echo.
    echo  DERLEME BASARISIZ. Yukaridaki hataya bakin.
    pause
    exit /b 1
)

echo.
echo  Sunucu baslatiliyor...
start "Firma Yonetim Sunucusu (Uretim)" /min cmd /k npm start

rem Port 3000 dinlemeye baslayana kadar bekle (en fazla 4 dakika)
set /a deneme=0
:bekle
timeout /t 2 /nobreak >nul
set /a deneme+=1
if %deneme% gtr 120 (
    echo  Sunucu baslatilamadi. Sunucu penceresindeki hataya bakin.
    pause
    exit /b 1
)
netstat -ano | findstr /C:":3000 " | findstr LISTENING >nul
if not %errorlevel%==0 goto bekle

start "" http://localhost:3000

:ipgoster
echo.
echo  Diger bilgisayarlardan baglanmak icin bu PC'nin IP adresini kullanin:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do echo    http://%%a:3000
echo.
echo  (Ilk kez baglanacak PC'lerde 3000 portunu guvenlik duvarindan acmayi unutmayin.)
echo.
pause
exit /b 0
