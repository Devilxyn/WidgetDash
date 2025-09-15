import os
import mimetypes
from flask import Flask, render_template, jsonify, request, send_from_directory, url_for
from dotenv import load_dotenv
import requests
from datetime import datetime

load_dotenv()

app = Flask(__name__)

# Defaults
DEFAULT_CITY = os.getenv("WD_CITY", "Verona")
UNITS = os.getenv("WD_UNITS", "metric")  # "metric" or "imperial"

# Music config
MUSIC_DIR = os.getenv("MUSIC_DIR", os.path.join(os.path.dirname(__file__), "media"))
os.makedirs(MUSIC_DIR, exist_ok=True)
AUDIO_EXTS = {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac", ".webm"}


@app.route("/")
def index():
    widget_library = [
        {"type": "clock", "name": "Clock"},
        {"type": "weather", "name": "Weather"},
        {"type": "player", "name": "Music Player"},
    ]
    return render_template("index.html", widget_library=widget_library, city=DEFAULT_CITY, units=UNITS)


@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat() + "Z"}


def geocode_city(city: str):
    """Geocode a city name using Open-Meteo's geocoding API (no key)."""
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": city, "count": 1, "language": "it", "format": "json"}
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    data = r.json()
    if not data.get("results"):
        return None
    res = data["results"][0]
    return {
        "lat": res["latitude"],
        "lon": res["longitude"],
        "name": res.get("name"),
        "country": res.get("country"),
    }


@app.get("/api/weather")
def api_weather():
    """
    Weather by city name (preferred) with fallback to lat/lon if provided.
    Query:
      - city (preferred)
      - units = metric|imperial
    """
    city = request.args.get("city", DEFAULT_CITY)
    units = request.args.get("units", UNITS)

    try:
        gc = geocode_city(city)
    except Exception as e:
        return jsonify({"error": f"Geocoding failed: {e}"}), 502

    if not gc:
        return jsonify({"error": f"City not found: {city}"}), 404

    temp_unit = "celsius" if units == "metric" else "fahrenheit"
    wind_unit = "kmh" if units == "metric" else "mph"

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": gc["lat"],
        "longitude": gc["lon"],
        "current": "temperature_2m,wind_speed_10m,weather_code",
        "temperature_unit": temp_unit,
        "wind_speed_unit": wind_unit,
        "timezone": "auto",
    }
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        cur = data.get("current", {})
        out = {
            "temperature": cur.get("temperature_2m"),
            "wind_speed": cur.get("wind_speed_10m"),
            "weather_code": cur.get("weather_code"),
            "units": units,
            "city": city,
        }
        return jsonify(out)
    except Exception as e:
        return jsonify({"error": str(e)}), 502


# ===== MUSIC PLAYER ROUTES =====
@app.get("/api/music/list")
def api_music_list():
    """Ritorna la playlist con titoli e URL riproducibili."""
    tracks = []
    for name in sorted(os.listdir(MUSIC_DIR)):
        path = os.path.join(MUSIC_DIR, name)
        if not os.path.isfile(path):
            continue
        ext = os.path.splitext(name)[1].lower()
        if ext not in AUDIO_EXTS:
            continue
        title = os.path.splitext(name)[0].replace("_", " ").replace("-", " ").strip()
        url = url_for("media_file", filename=name)
        tracks.append({"title": title, "url": url, "filename": name})
    return {"tracks": tracks}


@app.get("/media/<path:filename>")
def media_file(filename):
    mimetype, _ = mimetypes.guess_type(filename)
    return send_from_directory(MUSIC_DIR, filename, mimetype=mimetype, as_attachment=False, max_age=0)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    app.run(host=host, port=port, debug=True)
