// Player widget (SVG icons + polished UI)
WidgetRegistry.register("player", ({ editMode, cellIndex })=>{
  const w = document.createElement("div");
  w.className = "widget player";
  w.dataset.type = "player";
  w.draggable = editMode;

  // Small inline icon library (no external deps)
  const icons = {
    play: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7-11-7Z"/></svg>`,
    pause: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>`,
    next: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6l8 6-8 6V6zm9 0h2v12h-2z"/></svg>`,
    prev: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6v12l-8-6 8-6zM5 6h2v12H5z"/></svg>`,
    repeat: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 1l4 4-4 4V6H7a4 4 0 0 0-4 4v1H1v-1a6 6 0 0 1 6-6h10V1zm-10 22l-4-4 4-4v3h10a4 4 0 0 0 4-4v-1h2v1a6 6 0 0 1-6 6H7v3z"/></svg>`,
    shuffle: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3h2v3h3v2h-5V3zM4 4h4.5l2.7 3.6-1.6 1.2L7.9 6H4V4zm10.6 6.8l1.6-1.2L22 15v2h-5v3h-2v-5h3l-3.4-4.2zM4 18h3.9l2.7-3.6 1.6 1.2L8.5 20H4v-2z"/></svg>`,
    volume: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h4l5 4V6l-5 4H5zm10.1 2a3.1 3.1 0 0 0-1.1-2.4v4.8c.7-.6 1.1-1.5 1.1-2.4zm2.9 0a6 6 0 0 1-2.2 4.7l-1.1-1.6a4 4 0 0 0 0-6.2l1.1-1.6A6 6 0 0 1 18 12z"/></svg>`,
    upload: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l4 4h-3v6h-2V7H8l4-4zm-7 12h2v4h10v-4h2v6H5v-6z"/></svg>`,
  };

  w.innerHTML = `
    <div class="title">
      <span class="handle">🎧 <span class="badge">Music</span></span>
    </div>
    <div class="body player-body">
      <div class="cover"><div class="disc" aria-hidden="true">🎵</div></div>
      <div class="meta" role="group" aria-label="Now playing">
        <div class="track-title">No track</div>
        <div class="track-sub">—</div>
      </div>

      <div class="controls" role="group" aria-label="Player controls">
        <button class="btn icon" data-action="shuffle" aria-label="Shuffle" title="Shuffle">${icons.shuffle}</button>
        <button class="btn icon" data-action="prev" aria-label="Previous" title="Previous">${icons.prev}</button>
        <button class="btn icon play" data-action="play" aria-label="Play/Pause" title="Play">${icons.play}</button>
        <button class="btn icon" data-action="next" aria-label="Next" title="Next">${icons.next}</button>
        <button class="btn icon" data-action="repeat" aria-label="Repeat" title="Repeat">${icons.repeat}</button>
      </div>

      <div class="progress" aria-label="Progress">
        <span class="time tcur" aria-live="polite">0:00</span>
        <div class="bar" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
          <div class="fill"></div>
          <div class="knob" aria-hidden="true"></div>
        </div>
        <span class="time tdur">0:00</span>
      </div>

      <div class="volume" aria-label="Volume">
        <span class="vol-ico" aria-hidden="true">${icons.volume}</span>
        <input class="vol" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume slider"/>
      </div>

      <div class="playlist-wrap">
        <ul class="playlist"></ul>
        <label class="upload-btn" title="Add tracks">
          ${icons.upload} <span>Add tracks</span>
          <input type="file" class="file-input" multiple accept=".mp3,.m4a,.aac,.ogg,.wav,.flac,.webm"/>
        </label>
      </div>
    </div>
  `;

  // elements
  const titleEl = w.querySelector(".track-title");
  const subEl   = w.querySelector(".track-sub");
  const tcurEl  = w.querySelector(".tcur");
  const tdurEl  = w.querySelector(".tdur");
  const bar     = w.querySelector(".bar");
  const fill    = w.querySelector(".fill");
  const knob    = w.querySelector(".knob");
  const vol     = w.querySelector(".vol");
  const cover   = w.querySelector(".disc");
  const playBtn = w.querySelector('[data-action="play"]');
  const prevBtn = w.querySelector('[data-action="prev"]');
  const nextBtn = w.querySelector('[data-action="next"]');
  const repBtn  = w.querySelector('[data-action="repeat"]');
  const shfBtn  = w.querySelector('[data-action="shuffle"]');
  const playlistEl = w.querySelector(".playlist");
  const fileInput = w.querySelector(".file-input");

  // state
  let audio = new Audio();
  audio.preload = "metadata";
  let tracks = [];
  let index = 0;
  let repeating = false;
  let shuffling = false;
  let progressSeeking = false;

  // localStorage keys per cella
  const LS_PREFIX = `wd.widget.player.${cellIndex}`;
  const LS_VOL = `${LS_PREFIX}.volume`;
  const LS_LAST = `${LS_PREFIX}.lastIndex`;

  // helpers
  const fmt = (sec)=>{
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec/60);
    const s = Math.floor(sec%60).toString().padStart(2,"0");
    return `${m}:${s}`;
  };

  function setActive(i){
    playlistEl.querySelectorAll("li").forEach((li, k)=>{
      li.classList.toggle("active", k===i);
    });
  }

  function setPlayIcon(paused){
    playBtn.innerHTML = paused ? icons.play : icons.pause;
    playBtn.setAttribute("title", paused ? "Play" : "Pause");
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }

  function loadTrack(i){
    if (!tracks.length) return;
    index = ((i%tracks.length)+tracks.length)%tracks.length;
    const tr = tracks[index];
    audio.src = tr.url;
    titleEl.textContent = tr.title || tr.filename;
    subEl.textContent = tr.filename || "";
    setActive(index);
    localStorage.setItem(LS_LAST, String(index));
    // reset UI
    fill.style.width = "0%";
    knob.style.left = "0%";
    tcurEl.textContent = "0:00";
    tdurEl.textContent = "0:00";
    setPlayIcon(true);
    audio.load();
  }

  function playPause(){
    if (!tracks.length) return;
    if (audio.paused){ audio.play(); } else { audio.pause(); }
  }

  function next(){
    if (!tracks.length) return;
    loadTrack(shuffling ? Math.floor(Math.random()*tracks.length) : index+1);
    audio.play();
  }

  function prev(){
    if (!tracks.length) return;
    if (audio.currentTime > 3){ audio.currentTime = 0; return; }
    loadTrack(shuffling ? Math.floor(Math.random()*tracks.length) : index-1);
    audio.play();
  }

  function renderPlaylist(trs){
    playlistEl.innerHTML = "";
    trs.forEach((tr,i)=>{
      const li = document.createElement("li");
      li.textContent = tr.title || tr.filename;
      li.title = tr.filename || tr.title || "";
      li.addEventListener("click", ()=>{ loadTrack(i); audio.play(); });
      playlistEl.appendChild(li);
    });
  }

  // upload handler
  fileInput.addEventListener("change", async ()=>{
    const fd = new FormData();
    for (const f of fileInput.files){ fd.append("files", f); }
    try{
      const r = await fetch("/api/music/upload", {method:"POST", body:fd});
      const data = await r.json();
      if (data.saved && data.saved.length){
        await loadPlaylist(); // refresh
      }
    }catch(e){ console.error(e); }
    fileInput.value = "";
  });

  // events
  playBtn.addEventListener("click", playPause);
  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);
  repBtn.addEventListener("click", ()=>{
    repeating = !repeating;
    repBtn.classList.toggle("active", repeating);
  });
  shfBtn.addEventListener("click", ()=>{
    shuffling = !shuffling;
    shfBtn.classList.toggle("active", shuffling);
  });

  vol.addEventListener("input", ()=>{
    audio.volume = Number(vol.value);
    localStorage.setItem(LS_VOL, vol.value);
  });

  function seekTo(px, rect){
    const x = (px - rect.left) / rect.width;
    if (isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(1, x)) * audio.duration;
  }

  bar.addEventListener("pointerdown", (e)=>{
    progressSeeking = true;
    bar.setPointerCapture(e.pointerId);
    const rect = bar.getBoundingClientRect();
    seekTo(e.clientX, rect);
  });
  window.addEventListener("pointerup", ()=> progressSeeking=false);
  bar.addEventListener("pointermove", (e)=>{
    if (!progressSeeking) return;
    const rect = bar.getBoundingClientRect();
    seekTo(e.clientX, rect);
  });

  // keyboard support for progress slider
  bar.addEventListener("keydown", (e)=>{
    if (!isFinite(audio.duration)) return;
    const step = audio.duration / 50; // 2%
    if (e.key === "ArrowRight") { audio.currentTime = Math.min(audio.duration, audio.currentTime + step); }
    if (e.key === "ArrowLeft")  { audio.currentTime = Math.max(0, audio.currentTime - step); }
  });

  audio.addEventListener("play", ()=>{ setPlayIcon(false); cover.classList.add("spin"); });
  audio.addEventListener("pause", ()=>{ setPlayIcon(true); cover.classList.remove("spin"); });

  audio.addEventListener("timeupdate", ()=>{
    if (!isFinite(audio.duration)) return;
    tcurEl.textContent = fmt(audio.currentTime);
    tdurEl.textContent = fmt(audio.duration);
    const r = audio.currentTime / audio.duration;
    const pct = Math.max(0, Math.min(1, r))*100;
    fill.style.width = `${pct}%`;
    knob.style.left = `${pct}%`;
    bar.setAttribute("aria-valuenow", String(Math.round(pct)));
  });

  audio.addEventListener("ended", ()=>{
    if (repeating){ audio.currentTime = 0; audio.play(); return; }
    next();
  });

  // fetch playlist
  async function loadPlaylist(){
    try{
      const r = await fetch("/api/music/list", {cache:"no-store"});
      const data = await r.json();
      tracks = data.tracks || [];
    }catch(e){
      tracks = [];
      console.error(e);
    }

    renderPlaylist(tracks);

    if (!tracks.length){
      titleEl.textContent = "No track";
      subEl.textContent = "Add files to /media";
      return;
    }

    const savedVol = localStorage.getItem(LS_VOL);
    if (savedVol !== null){
      vol.value = savedVol;
      audio.volume = Number(savedVol);
    }

    const savedIdx = Number(localStorage.getItem(LS_LAST));
    loadTrack(Number.isInteger(savedIdx) ? savedIdx : 0);
  }

  loadPlaylist();
  return w;
});
