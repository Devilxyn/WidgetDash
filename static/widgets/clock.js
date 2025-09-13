// Clock widget
WidgetRegistry.register("clock", (editMode)=>{
  const w = document.createElement("div");
  w.className = "widget clock";
  w.dataset.type = "clock";
  w.draggable = editMode;
  w.innerHTML = `
    <div class="title">
      <span class="handle">🕒 <span class="badge">Clock</span></span>
    </div>
    <div class="body">
      <div class="time">--:--</div>
      <div class="date">--</div>
    </div>`;
  
  const timeEl = w.querySelector(".time");
  const dateEl = w.querySelector(".date");
  function tick(){
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    timeEl.textContent = `${hh}:${mm}`;
    dateEl.textContent = now.toLocaleDateString('it-IT', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  }
  tick();
  setInterval(tick, 10000);
  return w;
});
