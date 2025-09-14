// TaskList widget — persistenza locale per cella
// Salva i dati sotto chiave: wd.widget.tasklist.<cellIndex>
WidgetRegistry.register("tasklist", ({ editMode, cellIndex })=>{
  const STORAGE_KEY = `wd.widget.tasklist.${cellIndex}`;

  const w = document.createElement("div");
  w.className = "widget tasklist";
  w.dataset.type = "tasklist";
  w.draggable = editMode;
  w.innerHTML = `
    <div class="title">
      <span class="handle">📝 <span class="badge">TaskList</span></span>
    </div>
    <div class="body">
      <form class="task-form">
        <input class="task-input" type="text" placeholder="Aggiungi un obiettivo..." />
        <button class="ghost add-btn" type="submit">Aggiungi</button>
      </form>
      <ul class="task-list"></ul>
      <div class="task-actions">
        <button class="ghost clear-done">Rimuovi completati</button>
        <button class="ghost clear-all">Svuota tutto</button>
      </div>
    </div>`;

  const input = w.querySelector(".task-input");
  const form  = w.querySelector(".task-form");
  const list  = w.querySelector(".task-list");
  const btnClearDone = w.querySelector(".clear-done");
  const btnClearAll  = w.querySelector(".clear-all");

  // ---- storage helpers
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch{ return []; }
  }
  function save(items){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function render(items){
    list.innerHTML = "";
    items.forEach((it, idx)=>{
      const li = document.createElement("li");
      li.className = "task-item";
      li.innerHTML = `
        <label class="task-row">
          <input type="checkbox" class="task-check" ${it.done?"checked":""}/>
          <span class="task-text${it.done?" done":""}"></span>
        </label>
        <button class="ghost tiny del">✖</button>
      `;
      li.querySelector(".task-text").textContent = it.text;

      li.querySelector(".task-check").addEventListener("change", (e)=>{
        items[idx].done = e.target.checked;
        save(items); render(items);
      });
      li.querySelector(".del").addEventListener("click", ()=>{
        items.splice(idx,1);
        save(items); render(items);
      });
      list.appendChild(li);
    });
  }

  // init
  let items = load();
  render(items);

  // handlers
  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const txt = (input.value || "").trim();
    if (!txt) return;
    items.push({ text: txt, done: false });
    input.value = "";
    save(items); render(items);
  });

  btnClearDone.addEventListener("click", ()=>{
    items = items.filter(it => !it.done);
    save(items); render(items);
  });
  btnClearAll.addEventListener("click", ()=>{
    items = [];
    save(items); render(items);
  });

  return w;
});
