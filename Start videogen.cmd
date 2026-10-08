@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
set "NODE_BIN=%~dp0runtime\node-win-x64\node.exe"
if exist "%NODE_BIN%" goto run
if exist "%~dp0.portable" goto missing
for /f "delims=" %%N in ('where node 2^>nul') do if not defined SOURCE_NODE set "SOURCE_NODE=%%N"
if not defined SOURCE_NODE goto missing
set "NODE_BIN=%SOURCE_NODE%"
:run
if not exist "%~dp0server.js" goto missing
"%NODE_BIN%" "%~dp0scripts\check-runtime.cjs"
set "VIDEOGEN_EXIT=%ERRORLEVEL%"
if not "%VIDEOGEN_EXIT%"=="0" goto finish
"%NODE_BIN%" --no-use-env-proxy "%~dp0scripts\launcher.cjs"
set "VIDEOGEN_EXIT=%ERRORLEVEL%"
goto finish
:missing
echo The app or Node runtime is missing. Extract the whole ZIP before starting.
echo Source checkouts require Node 22.21+ (22.x) or 24.5+.
set "VIDEOGEN_EXIT=1"
:finish
if not "%VIDEOGEN_EXIT%"=="0" if not "%VIDEOGEN_NO_PAUSE%"=="1" if not "%OPEN_BROWSER%"=="0" pause
exit /b %VIDEOGEN_EXIT%
