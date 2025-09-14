// app.js v7 — la ✏️ è l'unico toggle: apre/chiude pannello + entra/esce da Modifica
// chiave stabile + migrazione da versioni precedenti
const LS_KEY = "wd.layout";  // 👈 fisso
const OLD_KEYS = ["wd.layout.v7","wd.layout.v6","wd.layout.v5","wd.layout.v4","wd.layout.v3","wd.layout.v2","wd.layout.v1"];

function migrateLayoutIfNeeded(){
  if (localStorage.getItem(LS_KEY)) return;
  for (const k of OLD_KEYS){
    const val = localStorage.getItem(k);
    if (val){
      localStorage.setItem(LS_KEY, val);
      break;
    }
  }
}

let editMode = false;

// ------- Registry -------
const WidgetRegistry = {
  types: {},
  register(name, factory){ this.types[name] = factory; },
  create(name, ctx){ if (!this.types[name]) return null; return this.types[name](ctx); }
};


// ------- Preset schema builder -------
const PRESETS = {
  "2x2": ()=>({ cols:2, rows:2, cells:Array.from({length:4},(_,i)=>({
      col:(i%2)+1, row:Math.floor(i/2)+1, colSpan:1, rowSpan:1
  })) }),
  "3x2": ()=>({ cols:3, rows:2, cells:Array.from({length:6},(_,i)=>({
      col:(i%3)+1, row:Math.floor(i/3)+1, colSpan:1, rowSpan:1
  })) }),
  "4x4": ()=>({ cols:4, rows:4, cells:Array.from({length:16},(_,i)=>({
      col:(i%4)+1, row:Math.floor(i/4)+1, colSpan:1, rowSpan:1
  })) }),

  // 1 lungo e stretto a sinistra, 3 impilati a destra
  "tall-left": ()=>({
    cols:4, rows:3,
    cells:[
      {col:1,row:1,colSpan:1,rowSpan:3},
      {col:2,row:1,colSpan:3,rowSpan:1},
      {col:2,row:2,colSpan:3,rowSpan:1},
      {col:2,row:3,colSpan:3,rowSpan:1},
    ]
  }),
  // specchiato
  "tall-right": ()=>({
    cols:4, rows:3,
    cells:[
      {col:1,row:1,colSpan:3,rowSpan:1},
      {col:1,row:2,colSpan:3,rowSpan:1},
      {col:1,row:3,colSpan:3,rowSpan:1},
      {col:4,row:1,colSpan:1,rowSpan:3},
    ]
  }),
  // 1 largo in alto e 3 di seguito sotto
  "wide-top": ()=>({
    cols:3, rows:2,
    cells:[
      {col:1,row:1,colSpan:3,rowSpan:1},
      {col:1,row:2,colSpan:1,rowSpan:1},
      {col:2,row:2,colSpan:1,rowSpan:1},
      {col:3,row:2,colSpan:1,rowSpan:1},
    ]
  }),
  // invertito: 3 sopra / 1 largo sotto
  "wide-bottom": ()=>({
    cols:3, rows:2,
    cells:[
      {col:1,row:1,colSpan:1,rowSpan:1},
      {col:2,row:1,colSpan:1,rowSpan:1},
      {col:3,row:1,colSpan:1,rowSpan:1},
      {col:1,row:2,colSpan:3,rowSpan:1},
    ]
  }),
};

let currentSchemaName = "2x2";
let gridCols = 2, gridRows = 2;

const grid = document.getElementById("grid");
const editPanel = document.getElementById("edit-panel");
const btnTogglePanel = document.getElementById("toggle-panel");

const btnPreset2 = document.getElementById("preset-2x2");
const btnPreset3 = document.getElementById("preset-3x2");
const btnPreset4 = document.getElementById("preset-4x4");
const btnTallLeft = document.getElementById("preset-tall-left");
const btnTallRight = document.getElementById("preset-tall-right");
const btnWideTop = document.getElementById("preset-wide-top");
const btnWideBottom = document.getElementById("preset-wide-bottom");
const btnClear = document.getElementById("clear-layout");

// impostazioni meteo lette dai widget
// (cfgCity/cfgUnits presenti nell'HTML)

function enableEditMode(on){
  editMode = on;
  document.querySelectorAll(".widget").forEach(w => { w.draggable = on; });
  document.body.classList.toggle("editing", on);
}

// Apertura/chiusura pannello: sincronizza SEMPRE la modalità modifica
function setPanelOpen(open){
  editPanel.classList.toggle("open", open);
  editPanel.setAttribute("aria-hidden", String(!open));
  const h = open ? `${editPanel.scrollHeight}px` : "0px";
  document.documentElement.style.setProperty("--panel-open-h", h);
  enableEditMode(open); // ✨ qui l’auto-toggle della modalità modifica
}

btnTogglePanel.addEventListener("click", ()=>{
  const isOpen = editPanel.classList.contains("open");
  setPanelOpen(!isOpen);
});

// Libreria drag (solo in edit)
function initLibraryDrag(){
  document.querySelectorAll(".lib-item").forEach(item => {
    item.addEventListener("dragstart", (e)=> {
      if (!editMode){ e.preventDefault(); return; }
      e.dataTransfer.setData("text/plain", item.dataset.type);
    });
  });
}
initLibraryDrag();

// Grid rendering
function renderSchema(name){
  const schema = PRESETS[name]();
  currentSchemaName = name;
  gridCols = schema.cols; gridRows = schema.rows;

  grid.style.gridTemplateColumns = `repeat(${schema.cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${schema.rows}, 1fr)`;
  grid.innerHTML = "";

  schema.cells.forEach((c, idx) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = idx;
    cell.style.gridColumn = `${c.col} / span ${c.colSpan}`;
    cell.style.gridRow    = `${c.row} / span ${c.rowSpan}`;

    const ph = document.createElement("div");
    ph.className = "placeholder";
    ph.textContent = "Trascina un widget qui";
    cell.appendChild(ph);

    setupDrop(cell);
    grid.appendChild(cell);
  });
}

function setupDrop(cell){
  cell.addEventListener("dragover", (e)=> {
    if (!editMode) return;
    e.preventDefault();
    cell.classList.add("drop-target");
  });
  cell.addEventListener("dragleave", ()=> cell.classList.remove("drop-target"));
  cell.addEventListener("drop", (e)=> {
    if (!editMode) return;
    e.preventDefault();
    cell.classList.remove("drop-target");
    const type = e.dataTransfer.getData("text/plain");
    placeWidget(cell, type);
    saveLayout();
  });
}

function placeWidget(cell, type){
  cell.innerHTML = "";
  const cellIndex = cell.dataset.index;
  const widget = WidgetRegistry.create(type, { editMode, cellIndex });
  if (!widget){ cell.innerHTML = "<div class='placeholder'>Widget non disponibile</div>"; return; }

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.innerHTML = "🗑️ Elimina";
  del.addEventListener("click", (e)=>{
    e.stopPropagation();
    cell.innerHTML = "";
    const ph = document.createElement("div");
    ph.className = "placeholder";
    ph.textContent = "Trascina un widget qui";
    cell.appendChild(ph);
    saveLayout();
  });

  widget.prepend(del);
  cell.appendChild(widget);
}


// Preset handlers
btnPreset2.addEventListener("click", ()=> { renderSchema("2x2"); saveLayout(); });
btnTallLeft.addEventListener("click",   ()=> { renderSchema("tall-left");   saveLayout(); });
btnTallRight.addEventListener("click",  ()=> { renderSchema("tall-right");  saveLayout(); });
btnWideTop.addEventListener("click",    ()=> { renderSchema("wide-top");    saveLayout(); });
btnWideBottom.addEventListener("click", ()=> { renderSchema("wide-bottom"); saveLayout(); });

btnClear.addEventListener("click", ()=> {
  localStorage.removeItem(LS_KEY);
  renderSchema("2x2");
});

// Persistenza (schema + tipi)
function saveLayout(){
  const layout = { schema: currentSchemaName, cells: [] };
  grid.querySelectorAll(".cell").forEach(cell => {
    const w = cell.querySelector(".widget");
    layout.cells.push(w ? w.dataset.type : null);
  });
  localStorage.setItem(LS_KEY, JSON.stringify(layout));
}
function loadLayout(){
  const raw = localStorage.getItem(LS_KEY);
  if (!raw){ renderSchema("2x2"); return; }
  try{
    const layout = JSON.parse(raw);
    const schemaName = layout.schema && PRESETS[layout.schema] ? layout.schema : "2x2";
    renderSchema(schemaName);
    const cells = grid.querySelectorAll(".cell");
    (layout.cells || []).forEach((type, i)=> {
      if (type && cells[i]) placeWidget(cells[i], type);
    });
  }catch(e){
    console.warn("layout parse error", e);
    renderSchema("2x2");
  }
}

// Start
setPanelOpen(false);   // pannello chiuso ⇒ NO modifica
migrateLayoutIfNeeded()
loadLayout();
