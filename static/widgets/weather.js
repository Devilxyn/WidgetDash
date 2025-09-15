// Weather widget (v3+): description + day/night icons + hourly refresh + backend/legacy compatibility
WidgetRegistry.register("weather", ({ editMode, cellIndex })=>{
  const w = document.createElement("div");
  w.className = "widget weather";
  w.dataset.type = "weather";
  w.draggable = editMode;
  w.innerHTML = `
    <div class="title">
      <span class="handle">⛅ <span class="badge">Weather</span></span>
      <button class="ghost small refresh" title="Aggiorna">↻</button>
    </div>
    <div class="body weather-body">
      <div class="main-info">
        <img class="icon" alt="weather icon" src="" />
        <div class="temp">--°</div>
      </div>
      <div class="desc">—</div>
      <div class="meta">Città: --</div>
    </div>`;

  const tempEl = w.querySelector(".temp");
  const metaEl = w.querySelector(".meta");
  const descEl = w.querySelector(".desc");
  const iconEl = w.querySelector(".icon");

  function getIconUrlFromOW(code, isDay){
    if (code === 800) return `https://openweathermap.org/img/wn/${isDay?'01d':'01n'}@2x.png`;
    if (String(code).startsWith("80")) return `https://openweathermap.org/img/wn/${isDay?'02d':'02n'}@2x.png`;
    const map = { "2":"11", "3":"09", "5":"10", "6":"13", "7":"50" };
    const key = String(code)[0];
    const base = map[key] || "01";
    return `https://openweathermap.org/img/wn/${base}${isDay?'d':'n'}@2x.png`;
  }

  function getIconUrlFromWMO(code, isDay){
    if (code === 0) return `https://openweathermap.org/img/wn/${isDay?'01d':'01n'}@2x.png`;
    if ([1,2].includes(code)) return `https://openweathermap.org/img/wn/${isDay?'02d':'02n'}@2x.png`;
    if (code === 3) return `https://openweathermap.org/img/wn/${isDay?'03d':'03n'}@2x.png`;
    if ([45,48].includes(code)) return `https://openweathermap.org/img/wn/50${isDay?'d':'n'}@2x.png`;
    if ([51,53,55,56,57].includes(code)) return `https://openweathermap.org/img/wn/09${isDay?'d':'n'}@2x.png`;
    if ([61,63,65,66,67,80,81,82].includes(code)) return `https://openweathermap.org/img/wn/10${isDay?'d':'n'}@2x.png`;
    if ([71,73,75,77,85,86].includes(code)) return `https://openweathermap.org/img/wn/13${isDay?'d':'n'}@2x.png`;
    if ([95,96,99].includes(code)) return `https://openweathermap.org/img/wn/11${isDay?'d':'n'}@2x.png`;
    return `https://openweathermap.org/img/wn/${isDay?'02d':'02n'}@2x.png`;
  }

  async function fetchWeather(city, units){
    const u = new URL("/api/weather", window.location.origin);
    u.searchParams.set("city", city);
    u.searchParams.set("units", units);
    const r = await fetch(u.toString(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function refresh(){
    try{
      const city = (document.getElementById("cfg-city").value || window.WD_DEFAULTS.city).trim();
      const units = document.getElementById("cfg-units").value || window.WD_DEFAULTS.units;
      const data = await fetchWeather(city, units);
      if (data.error) throw new Error(data.error);

      const unitSymbol = units === "metric" ? "°C" : "°F";
      tempEl.textContent = Math.round(data.temperature) + unitSymbol;
      metaEl.textContent = `Città: ${data.city} • Vento: ${Math.round(data.wind_speed)} ${units==="metric"?"km/h":"mph"}`;

      // description if provided by backend, else fallback
      descEl.textContent = data.description || "—";

      // decide day/night
      const nowSec = Math.floor(Date.now()/1000);
      let isDay;
      if (typeof data.is_day !== "undefined") {
        isDay = Boolean(data.is_day);
      } else if (data.sunrise && data.sunset) {
        isDay = nowSec >= data.sunrise && nowSec < data.sunset;
      } else {
        const h = new Date().getHours();
        isDay = h >= 7 && h < 19;
      }
      w.classList.toggle("weather-day",  isDay === true);
      w.classList.toggle("weather-night", isDay === false);

      // code: support both 'code' and legacy 'weather_code'
      const code = (data.code ?? data.weather_code);
      let iconUrl;
      if (typeof code === "number" && code >= 200 && code <= 899) {
        iconUrl = getIconUrlFromOW(code, isDay);
      } else {
        iconUrl = getIconUrlFromWMO(code, isDay);
      }
      iconEl.src = iconUrl;
      iconEl.style.display = "block";
    }catch(e){
      tempEl.textContent = "--";
      metaEl.textContent = "Errore meteo";
      descEl.textContent = "—";
      iconEl.style.display = "none";
      console.error(e);
    }
  }

  refresh();
  setInterval(refresh, 60 * 60 * 1000); // ogni ora
  w.querySelector(".refresh").addEventListener("click", refresh);

  return w;
});
