#!/bin/bash
# run_background.sh - Uruchom aplikację w tle

echo "🚀 Uruchamiam Generator Ofert w tle..."

# Sprawdź LibreOffice
if ! command -v soffice &> /dev/null; then
    echo "❌ LibreOffice nie znaleziony!"
    echo "Zainstaluj: sudo apt-get install libreoffice libreoffice-writer"
    exit 1
fi

# Uruchom aplikację w tle
nohup python3 app.py > app.log 2>&1 &
APP_PID=$!

sleep 3

if ps -p $APP_PID > /dev/null 2>&1; then
    echo "✅ Aplikacja uruchomiona! PID: $APP_PID"
    echo "📊 Logi: tail -f app.log"
    echo "🌐 URL: http://localhost:40207"
    echo "🛑 Stop: ./stop.sh lub kill $APP_PID"
else
    echo "❌ Błąd uruchamiania aplikacji"
    echo "📄 Sprawdź logi: cat app.log"
fi
