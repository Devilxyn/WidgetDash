// Weather widget
WidgetRegistry.register("weather", (editMode)=>{
  const w = document.createElement("div");
  w.className = "widget weather";
  w.dataset.type = "weather";
  w.draggable = editMode;
  w.innerHTML = `
    <div class="title">
      <span class="handle">⛅ <span class="badge">Weather</span></span>
      <button class="ghost small refresh" title="Aggiorna">Aggiorna</button>
    </div>
    <div class="body">
      <div class="temp">--°</div>
      <div class="meta">Città: -- • Vento --</div>
    </div>`;

  const tempEl = w.querySelector(".temp");
  const metaEl = w.querySelector(".meta");
  const refreshBtn = w.querySelector(".refresh");

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
    }catch(e){
      tempEl.textContent = "--";
      metaEl.textContent = "Errore meteo";
      console.error(e);
    }
  }

  refresh();
  setInterval(refresh, 10 * 60 * 1000);
  refreshBtn.addEventListener("click", refresh);

  return w;
});
