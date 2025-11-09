#!/bin/bash
# stop.sh - Zatrzymaj wszystkie serwisy

echo "🛑 Zatrzymuję Generator Ofert..."

# Zabij Flask
pkill -f "python.*app.py" && echo "✓ Zatrzymano aplikację" || echo "  Aplikacja nie działała"

echo "✅ Zatrzymano!"
