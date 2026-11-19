@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
  set "PY=py -3"
) else (
  set "PY=python"
)
echo Installing photo-library dependencies if needed...
%PY% -m pip install requests pillow
if errorlevel 1 (
  echo Could not install required Python packages. Please check your Python installation.
  pause
  exit /b 1
)
echo.
echo Searching Wikimedia Commons for up to 30 unique, open-licensed photos in each category.
echo There will be no image substitutions for missing or unsuitable categories.
%PY% tools\download_photo_library.py --target 30
if errorlevel 1 (
  echo Photo download was interrupted. Already downloaded photos are preserved.
  pause
  exit /b 1
)
echo.
echo Photo library update completed. Start the website in Live Server and refresh.
pause
