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

# Minimal WMO code → human description
WMO_DESC = {
    0: "Clear sky",
    1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Intense drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle (dense)",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain (heavy)",
    71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
    77: "Snow grains",
    80: "Rain showers (slight)", 81: "Rain showers (moderate)", 82: "Rain showers (violent)",
    85: "Snow showers (slight)", 86: "Snow showers (heavy)",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
}


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
        "current": "temperature_2m,wind_speed_10m,weather_code,is_day",
        "daily": "sunrise,sunset",
        "temperature_unit": temp_unit,
        "wind_speed_unit": wind_unit,
        "timezone": "auto",
    }
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        cur = data.get("current", {})
        daily = data.get("daily", {})

        # sunrise/sunset: Open-Meteo returns ISO strings; convert to epoch seconds if available
        def to_epoch(s):
            try:
                # strings may be like "2025-09-15T06:57" or "...Z"
                return int(datetime.fromisoformat(s.replace("Z", "")).timestamp())
            except Exception:
                return None

        sunrise = None
        sunset = None
        if isinstance(daily.get("sunrise"), list) and daily["sunrise"]:
            sunrise = to_epoch(daily["sunrise"][0])
        if isinstance(daily.get("sunset"), list) and daily["sunset"]:
            sunset = to_epoch(daily["sunset"][0])

        code = cur.get("weather_code")
        out = {
            "temperature": cur.get("temperature_2m"),
            "wind_speed": cur.get("wind_speed_10m"),
            "code": code,                                # 👈 align with frontend
            "description": WMO_DESC.get(code, None),     # helpful text
            "is_day": cur.get("is_day"),
            "sunrise": sunrise,
            "sunset": sunset,
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


@app.post("/api/music/upload")
def api_music_upload():
    """Permette di caricare più file audio dal browser (estensioni in AUDIO_EXTS)."""
    if "files" not in request.files:
        return {"error": "no files"}, 400
    files = request.files.getlist("files")
    saved = []
    for f in files:
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in AUDIO_EXTS:
            continue
        safe_name = os.path.basename(f.filename)  # evita path traversal
        dest = os.path.join(MUSIC_DIR, safe_name)
        f.save(dest)
        saved.append(safe_name)
    return {"saved": saved}


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    app.run(host=host, port=port, debug=True)
