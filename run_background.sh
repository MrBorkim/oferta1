#!/bin/bash
# run_background.sh - Uruchom aplikację w tle

export PATH="$HOME/.local/bin:/root/.local/bin:$PATH"

echo "🚀 Uruchamiam Generator Ofert w tle..."

# Uruchom unoserver jeśli nie działa
if ! pgrep -f "unoserver" > /dev/null; then
    echo "🔧 Startuję unoserver..."
    nohup unoserver --daemon > /dev/null 2>&1 &
    sleep 2
fi

# Uruchom aplikację w tle
nohup python3 app.py > app.log 2>&1 &
APP_PID=$!

sleep 3

if ps -p $APP_PID > /dev/null; then
    echo "✅ Aplikacja uruchomiona! PID: $APP_PID"
    echo "📊 Logi: tail -f app.log"
    echo "🌐 URL: http://localhost:40207"
    echo "🛑 Stop: ./stop.sh"
else
    echo "❌ Błąd uruchamiania aplikacji"
    echo "📄 Sprawdź logi: cat app.log"
fi
