/* =====================================================================
   APP — scene flow, rendering, reveal choreography, lightbox
   ===================================================================== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const DEFAULTS = clone(window.SURPRISE_DATA);
  let DATA = clone(DEFAULTS);

  const ORDER = ["welcome", "memories", "gang", "letter", "reveal", "finale"];
  const scenes = Object.fromEntries($$(".scene").map((s) => [s.dataset.scene, s]));
  const state = { current: "welcome", visited: new Set(["welcome"]), revealed: false, revealing: false, letterOpened: false, entered: {} };

  /* ---------------------------------------------------------------
     Ambient mood per scene
     --------------------------------------------------------------- */
  const MOODS = {
    welcome: { petals: 18, sparkles: 26, hearts: 0, dark: false },
    memories: { petals: 10, sparkles: 10, hearts: 0, dark: false },
    gang: { petals: 8, sparkles: 12, hearts: 4, dark: false },
    letter: { petals: 14, sparkles: 18, hearts: 0, dark: false },
    reveal: { petals: 0, sparkles: 40, hearts: 0, dark: true },
    finale: { petals: 22, sparkles: 16, hearts: 8, dark: false }
  };

  /* ---------------------------------------------------------------
     Navigation
     --------------------------------------------------------------- */
  const dotsNav = $("#dots");
  ORDER.forEach((name) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "dot"; b.dataset.target = name;
    b.dataset.label = scenes[name].dataset.label;
    b.setAttribute("aria-label", scenes[name].dataset.label);
    b.addEventListener("click", () => goTo(name));
    dotsNav.append(b);
  });

  function updateDots() {
    $$(".dot").forEach((d) => {
      const name = d.dataset.target;
      const locked = name === "reveal" && !state.revealed && !state.visited.has("reveal");
      d.disabled = !state.visited.has(name) && !(name === nextOf(state.current) && name !== "reveal");
      d.classList.toggle("is-current", name === state.current);
      d.classList.toggle("is-locked", locked);
    });
  }
  const nextOf = (name) => ORDER[ORDER.indexOf(name) + 1];

  function goTo(name) {
    if (name === state.current || !scenes[name]) return;
    if (state.revealing) return; // don't interrupt the big moment
    const from = scenes[state.current], to = scenes[name];
    from.classList.add("is-leaving");
    from.classList.remove("is-active");
    setTimeout(() => from.classList.remove("is-leaving"), 1200);
    to.scrollTop = 0;
    to.classList.add("is-active");
    state.current = name;
    state.visited.add(name);
    const mood = MOODS[name];
    document.body.classList.toggle("is-dark", mood.dark);
    FX.setAmbient(mood);
    updateDots();
    onEnter(name);
  }

  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-goto]");
    if (g) goTo(g.dataset.goto);
  });

  /* ---------------------------------------------------------------
     Music button
     --------------------------------------------------------------- */
  const musicBtn = $("#musicBtn");
  function setMusicUI(on) {
    musicBtn.classList.toggle("is-playing", on);
    musicBtn.setAttribute("aria-pressed", String(on));
    musicBtn.setAttribute("aria-label", on ? "Pause music" : "Play music");
  }
  musicBtn.addEventListener("click", async () => {
    if (Sound.playing) { Sound.pause(); setMusicUI(false); }
    else setMusicUI(await Sound.play());
  });

  /* ---------------------------------------------------------------
     Rendering from DATA
     --------------------------------------------------------------- */
  function img(src, alt = "", { lazy = true } = {}) {
    const i = new Image();
    i.src = src; i.alt = alt; i.decoding = "async";
    if (lazy) i.loading = "lazy";
    return i;
  }

  function renderStatic() {
    $("#welcomeHeading").textContent = DATA.welcome.heading;
    $("#welcomeSub").textContent = DATA.welcome.sub;
    Sound.setCustomMusic(DATA.music || "");
    renderScrapbook();
    renderGang();
    renderFinale();
  }

  // deterministic "random" tilt so the layout stays the same each visit
  const tilt = (i) => [-3.2, 2.4, -1.4, 3, -2.2, 1.6, -3.6, 2.8][i % 8];

  function renderScrapbook() {
    const wrap = $("#scrapbook");
    wrap.innerHTML = "";
    DATA.memories.forEach((m, i) => {
      const fig = document.createElement("figure");
      fig.className = "polaroid";
      fig.tabIndex = 0;
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", "Open photo: " + (m.caption || "memory"));
      fig.style.setProperty("--r", tilt(i) + "deg");
      const box = document.createElement("div");
      box.className = "polaroid__img";
      box.append(img(m.src, m.caption || "Friends memory"));
      const cap = document.createElement("figcaption");
      cap.textContent = m.caption || "";
      const tape = document.createElement("span"); tape.className = "polaroid__tape";
      const heart = document.createElement("span"); heart.className = "polaroid__heart"; heart.textContent = "♥";
      fig.append(tape, box, cap, heart);
      const openIt = () => Lightbox.open(DATA.memories.map((x) => ({ src: x.src, caption: x.caption })), i);
      fig.addEventListener("click", openIt);
      fig.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIt(); } });
      wrap.append(fig);
    });
  }

  function renderGang() {
    const grid = $("#gangGrid");
    grid.innerHTML = "";
    DATA.gang.forEach((f, i) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      card.setAttribute("aria-label", `${f.name || f.title} — tap to read their wish`);
      card.innerHTML = `
        <span class="card__inner">
          <span class="card__face card__front">
            <span class="card__tap" aria-hidden="true">♥</span>
            <span class="card__meta"><span class="card__name"></span><span class="card__title"></span></span>
          </span>
          <span class="card__face card__back">
            <span class="card__back-head"></span>
            <span class="card__back-sub">A wish for you</span>
            <span class="card__wish"></span>
            <span class="card__memory"></span>
          </span>
        </span>`;
      card.querySelector(".card__front").prepend(img(f.src, f.name || f.title));
      card.querySelector(".card__name").textContent = f.name || f.title;
      card.querySelector(".card__title").textContent = f.name ? f.title : "From your gang";
      card.querySelector(".card__back-head").textContent = f.name || f.title;
      card.querySelector(".card__wish").textContent = "“" + f.wish + "”";
      const mem = card.querySelector(".card__memory");
      if (f.memory) mem.textContent = f.memory; else mem.remove();
      card.addEventListener("click", () => {
        const flipping = !card.classList.contains("is-flipped");
        card.classList.toggle("is-flipped");
        if (flipping) {
          const r = card.getBoundingClientRect();
          FX.burst(r.left + r.width / 2, r.top + r.height / 3, 26);
          Sound.chime();
        }
      });
      grid.append(card);
    });
  }

  function renderFinale() {
    const pool = DATA.memories.map((m) => m.src);
    const fill = (row, list) => {
      row.innerHTML = "";
      const doubled = list.concat(list); // seamless loop
      doubled.forEach((src) => row.append(img(src, "")));
    };
    const half = Math.ceil(pool.length / 2);
    fill($("#marqueeA"), pool.slice(0, half).length ? pool.slice(0, half) : pool);
    fill($("#marqueeB"), pool.slice(half).length ? pool.slice(half) : pool);
    const ring = $("#gangRing");
    ring.innerHTML = "";
    DATA.gang.forEach((g, i) => {
      const im = img(g.src, g.name || g.title);
      im.title = g.name || g.title;
      im.style.animationDelay = i * 0.08 + "s";
      ring.append(im);
    });
  }

  /* ---------------------------------------------------------------
     Scene enter hooks
     --------------------------------------------------------------- */
  function onEnter(name) {
    if (name === "memories") revealSequential($$(".polaroid", scenes.memories), scenes.memories, 220);
    if (name === "gang") revealSequential($$(".card", scenes.gang), scenes.gang, 140);
    if (name === "letter") prepareLetter();
    if (name === "reveal") startReveal();
    if (name === "finale") enterFinale();
  }

  // reveal items one by one, as they scroll into view
  function revealSequential(items, rootEl, gap) {
    let queue = [], timer = null;
    const pump = () => {
      if (!queue.length) { timer = null; return; }
      queue.shift().classList.add("is-shown");
      timer = setTimeout(pump, gap);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && !en.target.classList.contains("is-shown")) {
          queue.push(en.target); io.unobserve(en.target);
        }
      });
      queue.sort((a, b) => items.indexOf(a) - items.indexOf(b));
      if (!timer) pump();
    }, { root: rootEl, threshold: 0.12 });
    items.forEach((it) => io.observe(it));
  }

  /* ---------------------------------------------------------------
     STEP 1 · Welcome
     --------------------------------------------------------------- */
  let starting = false;
  async function startSurprise() {
    if (starting) return;
    starting = true;
    Sound.unlock();
    const gift = $("#gift");
    gift.classList.add("is-open");
    const r = gift.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.height * 0.35, 110);
    FX.rainPetals(30);
    if ($("#musicPref").checked) setMusicUI(await Sound.play());
    document.body.classList.add("has-started");
    await wait(1300);
    goTo("memories");
    setTimeout(() => { gift.classList.remove("is-open"); starting = false; }, 1500);
  }
  $("#startBtn").addEventListener("click", startSurprise);
  $("#gift").addEventListener("click", startSurprise);

  /* ---------------------------------------------------------------
     STEP 4 · Envelope + typing letter
     --------------------------------------------------------------- */
  let typingToken = 0;
  function prepareLetter() {
    if (state.letterOpened) return;
    const env = $("#envelope");
    env.classList.remove("is-open", "is-gone");
    $("#letter").classList.remove("is-open", "is-done");
    $("#letterFoot").classList.add("scene-foot--hidden");
    $("#envelopeHint").textContent = "Tap the golden seal to open it.";
  }

  async function openEnvelope() {
    if (state.letterOpened) return;
    state.letterOpened = true;
    const env = $("#envelope");
    const r = env.getBoundingClientRect();
    env.classList.add("is-open");
    FX.burst(r.left + r.width / 2, r.top + r.height * 0.6, 60);
    Sound.chime();
    $("#envelopeHint").textContent = "Sealed with love, from all of us.";
    await wait(1900);
    env.classList.add("is-gone");
    await wait(500);
    const letter = $("#letter");
    letter.classList.add("is-open");
    await typeLetter();
  }
  $("#envelope").addEventListener("click", openEnvelope);

  async function typeLetter() {
    const token = ++typingToken;
    const L = DATA.letter;
    const greet = $("#letterGreeting"), bodyEl = $("#letterBody");
    greet.textContent = ""; bodyEl.textContent = "";
    $("#letterSign").textContent = L.signoff;
    $("#letterFrom").textContent = L.from;
    await typeInto(greet, L.greeting, 55, token);
    await wait(350);
    await typeInto(bodyEl, L.body, 26, token);
    if (token !== typingToken) return;
    $("#letter").classList.add("is-done");
    await wait(900);
    $("#letterFoot").classList.remove("scene-foot--hidden");
    FX.hearts(12);
  }

  async function typeInto(node, text, speed, token) {
    const caret = document.createElement("span");
    caret.className = "caret";
    const textNode = document.createTextNode("");
    node.append(textNode, caret);
    const chars = [...text];
    if (reduced) { textNode.data = text; caret.remove(); return; }
    for (let i = 0; i < chars.length; i++) {
      if (token !== typingToken) return;
      textNode.data += chars[i];
      const c = chars[i];
      const pause = c === "\n" ? 260 : /[.,!?—]/.test(c) ? speed * 6 : speed;
      // keep the newest line in view while typing
      if (i % 20 === 0) {
        const sc = scenes.letter, b = caret.getBoundingClientRect();
        if (b.bottom > window.innerHeight - 80) sc.scrollBy({ top: b.bottom - window.innerHeight + 120, behavior: "smooth" });
      }
      await wait(pause);
    }
    caret.remove();
  }
  // tap the letter to skip typing
  $("#letter").addEventListener("click", () => {
    if ($("#letter").classList.contains("is-done")) return;
    typingToken++;
    $("#letterGreeting").textContent = DATA.letter.greeting;
    $("#letterBody").textContent = DATA.letter.body;
    $("#letter").classList.add("is-done");
    setTimeout(() => $("#letterFoot").classList.remove("scene-foot--hidden"), 600);
  });

  /* ---------------------------------------------------------------
     STEP 5 + 6 · Grand reveal & wedding gallery
     --------------------------------------------------------------- */
  function buildWedding() {
    // Wedding photos enter the page only now — never earlier.
    const W = DATA.wedding;
    const R = DATA.reveal;
    $("#revealTitle").textContent = R.title;
    $("#revealHeadline").textContent = R.headline;
    $("#revealNames").textContent = R.couple || "";
    $("#revealMessage").textContent = R.message;
    const frame = $("#heroFrame");
    frame.innerHTML = "";
    if (W[0]) {
      frame.append(img(W[0].src, "The bride and groom", { lazy: false }));
      ["tl", "tr", "bl", "br"].forEach((p) => {
        const s = document.createElement("span");
        s.className = "hero-corner hero-corner--" + p; s.textContent = "✦"; frame.append(s);
      });
      frame.onclick = () => Lightbox.open(W, 0);
    }
    const grid = $("#albumGrid");
    grid.innerHTML = "";
    W.slice(1).forEach((w, i) => {
      const fig = document.createElement("figure");
      fig.className = "album__item";
      fig.tabIndex = 0;
      fig.setAttribute("role", "button");
      fig.append(img(w.src, w.caption || "Wedding photo"));
      if (w.caption) { const c = document.createElement("figcaption"); c.textContent = w.caption; fig.append(c); }
      const openIt = () => Lightbox.open(W, i + 1);
      fig.addEventListener("click", openIt);
      fig.addEventListener("keydown", (e) => { if (e.key === "Enter") openIt(); });
      grid.append(fig);
    });
    $(".album").hidden = W.length < 2;
    // staged elements
    $("#revealTitle").dataset.stage = "1";
    frame.dataset.stage = "2";
    $("#revealNames").dataset.stage = "3";
    $("#revealHeadline").dataset.stage = "4";
    $("#revealMessage").dataset.stage = "5";
    $(".scroll-cue").dataset.stage = "6";
    $$("[data-stage]", $("#wedding")).forEach((n) => n.classList.remove("is-on"));
  }

  function preload(srcs) {
    return Promise.all(srcs.map((src) => new Promise((res) => {
      const i = new Image(); i.onload = i.onerror = res; i.src = src;
    })));
  }

  async function startReveal() {
    const scene = scenes.reveal;
    if (state.revealed) { scene.classList.remove("is-locked"); return; }
    if (state.revealing) return;
    state.revealing = true;
    scene.classList.add("is-locked");
    document.body.classList.add("is-revealing");

    const intro = $("#revealIntro"), line = $("#introLine"), cd = $("#countdown"), num = $("#countNum"), ring = $("#ringFg");
    const theatre = $("#theatre"), wedding = $("#wedding");
    intro.classList.remove("is-hidden");
    theatre.classList.remove("is-open", "is-lit", "is-gone");
    theatre.hidden = false;
    wedding.hidden = true;

    // start loading the photos quietly behind the closed curtains
    const loading = preload(DATA.wedding.slice(0, 3).map((w) => w.src));
    Sound.duck(0.12, 1.5);

    await wait(900);
    line.classList.add("is-on");
    await wait(2600);
    line.classList.remove("is-on");
    await wait(900);
    cd.classList.add("is-on");
    for (let n = 5; n >= 1; n--) {
      num.textContent = n;
      num.classList.remove("is-pop"); void num.offsetWidth; num.classList.add("is-pop");
      ring.classList.remove("is-running"); void ring.getBoundingClientRect(); ring.classList.add("is-running");
      Sound.tick(n === 1);
      await wait(1000);
    }
    cd.classList.remove("is-on");
    await Promise.race([loading, wait(2500)]);

    buildWedding();
    wedding.hidden = false;
    intro.classList.add("is-hidden");
    Sound.reveal();
    theatre.classList.add("is-lit");
    await wait(400);
    theatre.classList.add("is-open");
    FX.setAmbient({ petals: 0, sparkles: 60, hearts: 0 });

    const stages = $$("[data-stage]", wedding).sort((a, b) => a.dataset.stage - b.dataset.stage);
    await wait(900);
    stages[1].classList.add("is-on"); // the portrait appears in the spotlight as the curtains part
    await wait(1500);
    stages[0].classList.add("is-on");
    FX.burst(window.innerWidth / 2, window.innerHeight * 0.45, 140);
    FX.confetti(180);
    await wait(900);
    theatre.classList.add("is-gone");
    FX.rainPetals(60);
    FX.hearts(18);
    for (const s of stages.slice(2)) { await wait(900); s.classList.add("is-on"); }

    state.revealed = true;
    state.revealing = false;
    scene.classList.remove("is-locked");
    document.body.classList.remove("is-revealing");
    FX.setAmbient({ petals: 14, sparkles: 34, hearts: 6 });
    Sound.unduck(3);
    updateDots();
    setTimeout(() => { theatre.hidden = true; }, 3000);
    revealSequential($$(".album__item", wedding), scene, 450);
  }

  /* ---------------------------------------------------------------
     STEP 7 · Finale
     --------------------------------------------------------------- */
  function enterFinale() {
    const couple = $("#finaleCouple");
    couple.innerHTML = "";
    if (state.revealed && DATA.wedding[0]) couple.append(img(DATA.wedding[0].src, "The happy couple", { lazy: false }));
    couple.hidden = !couple.children.length;
    $("#finaleNames").textContent = state.revealed ? (DATA.reveal.couple || "") : "";
    setTimeout(() => { FX.confetti(140); FX.hearts(14); }, 600);
  }
  $("#confettiBtn").addEventListener("click", () => { FX.confetti(200); FX.burst(window.innerWidth / 2, window.innerHeight / 2, 80); Sound.chime(); });

  $("#replayBtn").addEventListener("click", () => {
    // reset everything so the whole journey — including the reveal — plays again
    typingToken++;
    state.revealed = false;
    state.letterOpened = false;
    state.visited = new Set(["welcome"]);
    $("#wedding").hidden = true;
    $("#heroFrame").innerHTML = "";
    $("#albumGrid").innerHTML = "";
    $("#finaleCouple").innerHTML = "";
    $("#theatre").hidden = false;
    $("#theatre").classList.remove("is-open", "is-lit", "is-gone");
    renderScrapbook(); renderGang();
    goTo("welcome");
  });

  /* ---------------------------------------------------------------
     Lightbox with zoom + swipe
     --------------------------------------------------------------- */
  const Lightbox = (() => {
    const box = $("#lightbox"), vp = $("#lbViewport"), im = $("#lbImg"), cap = $("#lbCaption");
    let list = [], idx = 0, lastFocus = null;
    function show(i) {
      idx = (i + list.length) % list.length;
      vp.classList.remove("is-zoomed");
      im.style.transformOrigin = "50% 50%";
      im.classList.add("is-swapping");
      setTimeout(() => {
        im.src = list[idx].src;
        im.alt = list[idx].caption || "Photo";
        cap.textContent = list[idx].caption || "";
        im.onload = () => im.classList.remove("is-swapping");
        if (im.complete) im.classList.remove("is-swapping");
      }, 160);
      const multi = list.length > 1;
      $("#lbPrev").hidden = !multi; $("#lbNext").hidden = !multi;
    }
    function open(items, i) {
      list = items; lastFocus = document.activeElement;
      box.hidden = false; show(i);
      $("#lbClose").focus();
    }
    function close() { box.hidden = true; vp.classList.remove("is-zoomed"); lastFocus && lastFocus.focus && lastFocus.focus(); }
    $("#lbClose").addEventListener("click", close);
    $("#lbPrev").addEventListener("click", () => show(idx - 1));
    $("#lbNext").addEventListener("click", () => show(idx + 1));
    box.addEventListener("click", (e) => { if (e.target === box || e.target === vp) close(); });
    im.addEventListener("click", (e) => {
      if (moved) return;
      const r = im.getBoundingClientRect();
      im.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      vp.classList.toggle("is-zoomed");
    });
    vp.addEventListener("mousemove", (e) => {
      if (!vp.classList.contains("is-zoomed") || e.pointerType === "touch") return;
      const r = vp.getBoundingClientRect();
      im.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    });
    // swipe
    let sx = 0, sy = 0, moved = false;
    vp.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false; }, { passive: true });
    vp.addEventListener("touchmove", (e) => {
      if (vp.classList.contains("is-zoomed")) {
        const r = vp.getBoundingClientRect(), t = e.touches[0];
        im.style.transformOrigin = `${((t.clientX - r.left) / r.width) * 100}% ${((t.clientY - r.top) / r.height) * 100}%`;
        moved = true;
      }
    }, { passive: true });
    vp.addEventListener("touchend", (e) => {
      if (vp.classList.contains("is-zoomed")) { setTimeout(() => (moved = false), 50); return; }
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { moved = true; show(idx + (dx < 0 ? 1 : -1)); setTimeout(() => (moved = false), 50); }
    });
    document.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(idx + 1);
      if (e.key === "ArrowLeft") show(idx - 1);
    });
    return { open };
  })();

  /* ---------------------------------------------------------------
     Keyboard: Enter on welcome starts
     --------------------------------------------------------------- */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && state.current === "welcome" && document.activeElement === document.body) startSurprise();
  });

  /* ---------------------------------------------------------------
     Photo Studio (only when ?edit is in the URL)
     --------------------------------------------------------------- */
  const editMode = /[?&#]edit\b/.test(location.search + location.hash);
  if (editMode) {
    const btn = $("#studioOpen");
    btn.hidden = false;
    btn.addEventListener("click", () => Studio.open(DATA, DEFAULTS, (fresh) => { DATA = fresh; renderStatic(); }));
  }

  /* ---------------------------------------------------------------
     Boot
     --------------------------------------------------------------- */
  (async function boot() {
    const saved = await Studio.loadSaved();
    if (saved && saved.memories && saved.wedding) DATA = saved;
    renderStatic();
    FX.setAmbient(MOODS.welcome);
    updateDots();
  })();
})();
