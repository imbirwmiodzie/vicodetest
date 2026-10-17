@echo off
rem One-step local setup: downloads the photos, installs and builds the three demos,
rem then serves benchmark\ at http://localhost:8080/ (set PORT=... to change).
rem Needs Node.js 20.19+ or 22.13+ (with npm) and curl.exe (Windows 10 1803+).
setlocal
cd /d "%~dp0"
call media\fetch.cmd || goto :fail
for %%t in (remotion hyperframes revideo) do (
  echo == %%t: install + build
  pushd %%t
  call npm ci --no-audit --no-fund --loglevel=error || goto :fail
  call npm run build:demo --silent || goto :fail
  popd
)
if "%PORT%"=="" set PORT=8080
echo.
echo Open http://localhost:%PORT%/  (Ctrl+C to stop)
echo   Remotion:    http://localhost:%PORT%/remotion/dist-demo/router.html
echo   HyperFrames: http://localhost:%PORT%/hyperframes/dist-demo/router.html
echo   Revideo:     http://localhost:%PORT%/revideo/dist-demo/router.html
start "" http://localhost:%PORT%/
node harness\serve.mjs
exit /b 0

:fail
echo Setup failed, see the messages above.
exit /b 1
