@echo off
rem Double-click to install with the demo centre and demo accounts (password demo1234).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Demo
