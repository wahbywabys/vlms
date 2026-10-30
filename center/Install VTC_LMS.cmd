@echo off
rem Double-click to install or update the VTC_LMS centre server on this Windows computer.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
