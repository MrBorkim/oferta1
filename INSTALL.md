# 🚀 Instrukcja Instalacji i Uruchomienia

## ✅ Plik app.py jest POPRAWNY!

**UWAGA:** Jeśli widzisz błąd `IndentationError: unexpected indent` w linii 770, to prawdopodobnie:
1. Masz nieaktualną kopię pliku
2. Twój edytor zmienił formatowanie
3. Pobierz świeżą wersję z git

```bash
# Pobierz świeżą wersję
git pull origin claude/libreoffice-project-simplify-011CUxuS3zVe2Qj69qTSaLss
```

## 📦 Instalacja

### 1. Zainstaluj zależności systemowe:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y libreoffice libreoffice-writer python3 python3-pip

# Opcjonalnie: czcionki (dla lepszego renderowania)
sudo apt-get install -y fonts-liberation fonts-dejavu
```

### 2. Zainstaluj zależności Python:

```bash
pip install -r requirements.txt
# lub
pip3 install -r requirements.txt
```

### 3. Zainstaluj unoserver (dla super szybkiej konwersji):

```bash
pip install --user unoserver
# lub
pip3 install --user unoserver
```

## 🚀 Uruchamianie

### Metoda 1: Normalnie (interaktywnie)

```bash
./start.sh
```

Lub ręcznie:

```bash
export PATH="$HOME/.local/bin:$PATH"
python3 app.py
```

### Metoda 2: W tle (daemon)

```bash
./run_background.sh
```

**Sprawdź logi:**

```bash
tail -f app.log
```

**Zatrzymaj:**

```bash
./stop.sh
```

### Metoda 3: Tylko unoserver w tle

```bash
# Uruchom unoserver jako daemon
export PATH="$HOME/.local/bin:/root/.local/bin:$PATH"
unoserver --daemon

# Sprawdź czy działa
pgrep -f unoserver

# Potem uruchom aplikację normalnie
python3 app.py
```

## 🔧 Ręczne uruchomienie unoserver

Unoserver to serwer LibreOffice działający w tle, który przyspiesza konwersje **10x!**

### Uruchom jako daemon:

```bash
# Dodaj do PATH
export PATH="$HOME/.local/bin:/root/.local/bin:$PATH"

# Uruchom jako daemon (w tle)
unoserver --daemon

# Sprawdź status
pgrep -f unoserver
# Jeśli zwróci PID - działa!
```

### Uruchom w osobnym terminalu:

```bash
# Terminal 1 - uruchom unoserver
unoserver

# Terminal 2 - uruchom aplikację
python3 app.py
```

### Zatrzymaj unoserver:

```bash
pkill -f unoserver
```

## 🌐 Dostęp do aplikacji

Po uruchomieniu, aplikacja będzie dostępna na:

```
http://localhost:40207
http://127.0.0.1:40207
http://[twoje-ip]:40207
```

## 🐛 Rozwiązywanie problemów

### Problem: IndentationError w app.py

**Rozwiązanie:**

```bash
# 1. Sprawdź wersję pliku
md5sum app.py

# 2. Pobierz świeżą wersję z git
git checkout app.py

# 3. Lub pobierz z repo
git pull origin claude/libreoffice-project-simplify-011CUxuS3zVe2Qj69qTSaLss
```

### Problem: unoserver nie znaleziony

**Rozwiązanie:**

```bash
# Zainstaluj
pip install --user unoserver

# Dodaj do PATH w ~/.bashrc
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Sprawdź
which unoserver
```

### Problem: LibreOffice nie konwertuje

**Rozwiązanie:**

```bash
# Sprawdź czy LibreOffice jest zainstalowany
which soffice
soffice --version

# Jeśli nie ma, zainstaluj
sudo apt-get install libreoffice libreoffice-writer

# Test konwersji
soffice --headless --convert-to pdf test.docx
```

### Problem: Port 40207 zajęty

**Rozwiązanie:**

Zmień port w `app.py` (linia 912):

```python
socketio.run(app, debug=True, host='0.0.0.0', port=50207)  # Zmień na inny
```

## 📊 Sprawdzanie statusu

### Sprawdź czy wszystko działa:

```bash
# Sprawdź unoserver
pgrep -f unoserver && echo "✓ Unoserver działa" || echo "✗ Unoserver nie działa"

# Sprawdź Flask
pgrep -f "python.*app.py" && echo "✓ App działa" || echo "✗ App nie działa"

# Sprawdź port
netstat -tuln | grep 40207 || ss -tuln | grep 40207

# Test HTTP
curl http://localhost:40207/api/templates
```

## 🚀 Wydajność

### Z unoserver (ZALECANE):
- Konwersja DOCX→PDF: **~0.5-1s** ⚡
- Konwersja PDF→JPG: **~0.3-0.5s** ⚡
- **Razem: ~1-2s na dokument**

### Bez unoserver (fallback):
- Konwersja DOCX→PDF: **~5-10s** 🐌
- Konwersja PDF→JPG: **~0.3-0.5s**
- **Razem: ~5-10s na dokument**

## 📝 Struktura logów

```bash
# Logi aplikacji
tail -f app.log

# Logi unoserver (jeśli uruchomiony nie-daemon)
# Wyświetlane w terminalu

# Logi LibreOffice
# Brak (działa headless)
```

## 🎯 Quick Start (TL;DR)

```bash
# Instalacja
pip install -r requirements.txt
pip install --user unoserver

# Uruchomienie
./start.sh

# W przeglądarce
# http://localhost:40207
```

Gotowe! 🎉
