// Clock widget (v3): grande, centrato, colore dinamico, toggle 12/24h con persistenza per-cella
WidgetRegistry.register("clock", ({ editMode, cellIndex })=>{
  const FORMAT_KEY = `wd.widget.clock.format.${cellIndex}`; // "24" | "12"
  const initialFormat = localStorage.getItem(FORMAT_KEY) || "24";

  const w = document.createElement("div");
  w.className = "widget clock";
  w.dataset.type = "clock";
  w.draggable = editMode;
  w.innerHTML = `
    <div class="title">
      <span class="handle">🕒 <span class="badge">Clock</span></span>
    </div>
    <div class="body clock-body">
      <div class="time" title="Clicca per cambiare formato">--:--:--</div>
      <div class="date">--</div>
    </div>`;

  const timeEl = w.querySelector(".time");
  const dateEl = w.querySelector(".date");

  // ── gestione formato 12/24h
  let use24h = (initialFormat === "24");
  function toggleFormat(){
    use24h = !use24h;
    localStorage.setItem(FORMAT_KEY, use24h ? "24" : "12");
    tick(); // aggiorna subito
  }
  timeEl.addEventListener("click", toggleFormat);

  // ── colore dinamico per fascia oraria
  function phaseFromHour(h){
    if (h >= 6 && h <= 11) return "morning";     // 06–11
    if (h >= 12 && h <= 17) return "afternoon";  // 12–17
    if (h >= 18 && h <= 21) return "evening";    // 18–21
    return "night";                               // 22–05
  }
// sostituisci tutta applyPhase con questa versione
let currentPhaseClass = null;
function applyPhase(h){
  const p = phaseFromHour(h);
  const cls = `clock-${p}`;
  if (currentPhaseClass === cls) return; // non toccare nulla se è uguale
  w.classList.remove("clock-morning","clock-afternoon","clock-evening","clock-night");
  w.classList.add(cls);
  currentPhaseClass = cls;
}


  // ── render
  function tick(){
    const now = new Date();
    const h24 = now.getHours();
    applyPhase(h24);

    let h = h24, suffix = "";
    if (!use24h){
      suffix = h24 >= 12 ? " PM" : " AM";
      h = h24 % 12; if (h === 0) h = 12;
    }
    const hh = String(h).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    timeEl.textContent = `${hh}:${mm}:${ss}${use24h ? "" : suffix}`;

    dateEl.textContent = now.toLocaleDateString('it-IT', {
      weekday:'long', year:'numeric', month:'long', day:'numeric'
    });
  }

  tick();                   // subito
  setInterval(tick, 1000);  // ogni secondo
  return w;
});
