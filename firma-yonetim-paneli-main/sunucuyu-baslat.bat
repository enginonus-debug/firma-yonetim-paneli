@echo off
rem Firma Yonetim Paneli baslatma betigi
rem Not: Bu dosyada bilerek Turkce ozel karakter kullanilmiyor;
rem cmd.exe UTF-8 kaydedilen bat dosyalarini yanlis ayristiriyor.
title Firma Yonetim Paneli
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%PATH%"

echo.
echo  Firma Yonetim Paneli
echo  ====================

rem Sunucu zaten calisiyorsa yeniden baslatma, dogrudan tarayiciyi ac
netstat -ano | findstr /C:":3000 " | findstr LISTENING >nul
if %errorlevel%==0 (
    echo  Sunucu zaten calisiyor, tarayici aciliyor...
    start "" http://localhost:3000
    exit /b 0
)

rem PostgreSQL servisi normalde otomatik calisir; kapaliysa baslatmayi dene
netstat -ano | findstr /C:":5432 " | findstr LISTENING >nul
if not %errorlevel%==0 (
    echo  PostgreSQL servisi baslatiliyor...
    net start postgresql-x64-17 >nul 2>&1
)

echo  Sunucu baslatiliyor, tarayici otomatik acilacak...
echo.

rem Sunucuyu kucultulmus ayri pencerede baslat
rem (o pencere kapatilirsa sunucu durur)
start "Firma Yonetim Sunucusu" /min cmd /k npm run dev

rem Port 3000 dinlemeye baslayana kadar bekle (en fazla 4 dakika)
set /a deneme=0
:bekle
timeout /t 2 /nobreak >nul
set /a deneme+=1
if %deneme% gtr 120 (
    echo  Sunucu baslatilamadi. "Firma Yonetim Sunucusu" penceresindeki hataya bakin.
    pause
    exit /b 1
)
netstat -ano | findstr /C:":3000 " | findstr LISTENING >nul
if not %errorlevel%==0 goto bekle

start "" http://localhost:3000
exit /b 0
