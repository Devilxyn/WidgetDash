// Music Player widget — playlist dal server, UI carina, controlli completi
WidgetRegistry.register("player", ({ editMode, cellIndex })=>{
  const w = document.createElement("div");
  w.className = "widget player";
  w.dataset.type = "player";
  w.draggable = editMode;

  w.innerHTML = `
    <div class="title">
      <span class="handle">🎧 <span class="badge">Music</span></span>
    </div>
    <div class="body player-body">
      <div class="cover">
        <div class="disc">🎵</div>
      </div>
      <div class="meta">
        <div class="track-title">Nessun brano</div>
        <div class="track-sub">—</div>
      </div>

      <div class="controls">
        <button class="btn tiny" data-action="shuffle" title="Shuffle">🔀</button>
        <button class="btn" data-action="prev" title="Precedente">⏮️</button>
        <button class="btn play" data-action="play" title="Play/Pausa">▶️</button>
        <button class="btn" data-action="next" title="Successivo">⏭️</button>
        <button class="btn tiny" data-action="repeat" title="Repeat">🔁</button>
      </div>

      <div class="progress">
        <span class="time tcur">0:00</span>
        <div class="bar"><div class="fill"></div></div>
        <span class="time tdur">0:00</span>
      </div>

      <div class="volume">
        <span>🔊</span>
        <input class="vol" type="range" min="0" max="1" step="0.01" value="1"/>
      </div>

      <ul class="playlist"></ul>
    </div>
  `;

  // elements
  const titleEl = w.querySelector(".track-title");
  const subEl   = w.querySelector(".track-sub");
  const tcurEl  = w.querySelector(".tcur");
  const tdurEl  = w.querySelector(".tdur");
  const bar     = w.querySelector(".bar");
  const fill    = w.querySelector(".fill");
  const vol     = w.querySelector(".vol");
  const cover   = w.querySelector(".disc");
  const playBtn = w.querySelector('[data-action="play"]');
  const prevBtn = w.querySelector('[data-action="prev"]');
  const nextBtn = w.querySelector('[data-action="next"]');
  const repBtn  = w.querySelector('[data-action="repeat"]');
  const shfBtn  = w.querySelector('[data-action="shuffle"]');
  const playlistEl = w.querySelector(".playlist");

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
    tcurEl.textContent = "0:00";
    tdurEl.textContent = "0:00";
    playBtn.textContent = "▶️";
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

  bar.addEventListener("pointerdown", (e)=>{
    progressSeeking = true;
    const rect = bar.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(1, x)) * audio.duration;
  });
  window.addEventListener("pointerup", ()=> progressSeeking=false);
  bar.addEventListener("pointermove", (e)=>{
    if (!progressSeeking) return;
    const rect = bar.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(1, x)) * audio.duration;
  });

  audio.addEventListener("play", ()=>{ playBtn.textContent = "⏸️"; cover.classList.add("spin"); });
  audio.addEventListener("pause", ()=>{ playBtn.textContent = "▶️"; cover.classList.remove("spin"); });

  audio.addEventListener("timeupdate", ()=>{
    if (!isFinite(audio.duration)) return;
    tcurEl.textContent = fmt(audio.currentTime);
    tdurEl.textContent = fmt(audio.duration);
    const r = audio.currentTime / audio.duration;
    fill.style.width = `${Math.max(0, Math.min(1, r))*100}%`;
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

    // render lista
    playlistEl.innerHTML = "";
    tracks.forEach((tr, i)=>{
      const li = document.createElement("li");
      li.textContent = tr.title || tr.filename;
      li.title = tr.filename || tr.title;
      li.addEventListener("click", ()=>{ loadTrack(i); audio.play(); });
      playlistEl.appendChild(li);
    });

    if (!tracks.length){
      titleEl.textContent = "Nessun brano";
      subEl.textContent = "Aggiungi file in /media";
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
