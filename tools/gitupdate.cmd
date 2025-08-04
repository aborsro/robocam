@echo off

setlocal
set targetdir=c:/_Data/04-Vmware/xfer/Projects/GitHub/babyphone-webrtc-app
cd %targetdir%
if "%ERRORLEVEL%"=="0" goto doit
echo ... ERROR no such directory %targetdir%
goto skip

:doit
echo git add .
echo git commit -m %1
echo git push origin main

set /p antwort=ok (y/n):
if /i "%antwort%" NEQ "y" goto skip

echo .
echo ... git update starting
git add .
git commit -m %1
git push origin main
goto fin

:skip:
echo ... aborted

:fin
endlocal
