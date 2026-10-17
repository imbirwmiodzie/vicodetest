@echo off
rem Downloads the product photos used by the router demo into this folder.
rem Uses curl.exe, which ships with Windows 10 (1803) and later.
rem The photos belong to Swisscom and TCL/KOMSA, so they are not committed to the repo.
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set "KOMSA=https://www.komsa.pl/Images/Product/Alternative/xlarge/TCL%%20LINKKEY%%20IK41VE1-2ALCPL2%%20Modem%%204G%%20LTE%%20150%%20Mbs"
rem URLs go through a variable: "call" would expand the %%20 escapes a second time.
set "URL=https://cb-guide.swisscom.ch/en/assets/images/CB3_liegend-208f6c6bf6223955e7861e59178eb1bc.png"
call :get cb3-back.png || exit /b 1
set "URL=https://cb-guide.swisscom.ch/en/assets/images/CBG_HW_port_led_DE-609af2b08c3417ad0c4047d53cc6fdf3.png"
call :get cb3-front.png || exit /b 1
set "URL=!KOMSA!%%20(6).jpeg"
call :get tcl-ik41-front.jpeg || exit /b 1
set "URL=!KOMSA!%%20(7).jpeg"
call :get tcl-ik41-edge.jpeg || exit /b 1
exit /b 0

:get
if exist "%~1" (echo %~1: already there& exit /b 0)
curl.exe -fsSL --retry 3 -A "Mozilla/5.0" -o "%~1.part" "!URL!" || exit /b 1
move /y "%~1.part" "%~1" >nul
echo %~1: downloaded
exit /b 0
