@echo off
rem Mo slide anh cuoi qua may chu noi bo (bat duoc hieu ung WebGL). Dong cua so nay de tat.
cd /d "%~dp0"
start "" "http://localhost:8777/index.html"
python -m http.server 8777 --bind 127.0.0.1
