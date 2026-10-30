@echo off
rem Stop VTC_LMS on this computer (the data is kept).
cd /d "%~dp0"
docker compose stop
echo VTC_LMS stopped. Double-click "Start VTC_LMS" to start it again.
timeout /t 5 >nul
