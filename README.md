# WidgetDash

A tiny, self-hosted dashboard built with Flask + vanilla JS.  
Drag widgets onto a grid, customize the layout, check weather, keep a task list, and play your local music.

## Features
- 🧱 Drag-and-drop widget grid (saved to `localStorage`)
- ⏰ Clock (12/24h toggle, per-cell persistence)
- ⛅ Weather (Open-Meteo, no API key)
- 📝 Task list (per-cell persistence)
- 🎧 Music player (serves files from `./media`, upload from browser)

## Quickstart

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# optional: set defaults
export WD_CITY="Verona"
export WD_UNITS="metric"   # or "imperial"
export MUSIC_DIR="./media"

python app.py
# open http://localhost:8000
```
