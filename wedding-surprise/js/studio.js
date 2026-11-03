/* =====================================================================
   PHOTO STUDIO — upload, reorder, caption and edit everything in the
   browser. Open the site with ?edit in the URL to see the button.
   Changes are saved in this browser (IndexedDB). "Download data.js"
   bakes them into a file you can drop into the js/ folder to share.
   ===================================================================== */
(function () {
  const DB_NAME = "wedding-surprise", STORE = "kv", KEY = "data";
  const MAX_SIDE = { memories: 1400, gang: 900, wedding: 1800 };

  /* ---------- tiny IndexedDB wrapper ---------- */
  function db() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("no indexedDB"));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  const loadSaved = () => idb("readonly", (s) => s.get(KEY)).catch(() => null);
  const saveData = (data) => idb("readwrite", (s) => s.put(data, KEY));
  const clearData = () => idb("readwrite", (s) => s.delete(KEY));

  /* ---------- image optimisation (resize + recompress) ---------- */
  function optimise(file, maxSide) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read " + file.name)); };
      img.src = url;
    });
  }
  const readAsDataURL = (file) => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file);
  });

  /* ---------- UI ---------- */
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k in n) n[k] = v;
      else n.setAttribute(k, v);
    }
    kids.flat().forEach((c) => c != null && n.append(c));
    return n;
  };

  let draft = null, tab = "memories", onSaveCb = null, defaults = null;
  const root = document.getElementById("studio");
  const body = document.getElementById("studioBody");
  const status = document.getElementById("studioStatus");
  const say = (msg) => { status.textContent = msg; };

  function render() {
    body.innerHTML = "";
    root.querySelectorAll(".studio__tabs button").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === tab));
    if (tab === "words") return renderWords();
    const list = draft[tab];
    const hints = {
      memories: "Group photos of the whole gang. They appear as Polaroids in this order.",
      gang: "One photo per friend. Each becomes a flip card with a personal wish.",
      wedding: "Bride & groom photos — kept hidden until the curtains open. The FIRST photo is the big main portrait."
    };
    body.append(el("p", { class: "snote" }, hints[tab]));
    body.append(dropZone(tab));
    const ul = el("div", { class: "slist" });
    list.forEach((item, i) => ul.append(row(tab, item, i)));
    body.append(ul);
  }

  function dropZone(cat) {
    const input = el("input", { type: "file", accept: "image/*", multiple: true });
    const zone = el("label", { class: "drop" },
      el("strong", {}, "＋ Add photos"),
      el("span", {}, "Click or drop images here — they're resized automatically for fast loading on phones."),
      input);
    const handle = async (files) => {
      const imgs = [...files].filter((f) => f.type.startsWith("image/"));
      if (!imgs.length) return;
      say(`Optimising ${imgs.length} photo${imgs.length > 1 ? "s" : ""}…`);
      for (const f of imgs) {
        try {
          const src = await optimise(f, MAX_SIDE[cat]);
          const base = f.name.replace(/\.[^.]+$/, "");
          draft[cat].push(cat === "gang"
            ? { src, name: "", title: "Our Friend", memory: "", wish: "Happy married life! Wishing you endless love and laughter." }
            : { src, caption: cat === "wedding" ? "" : base });
        } catch (e) { say(e.message); }
      }
      say(`Added ${imgs.length}. Don't forget to save.`);
      render();
    };
    input.addEventListener("change", () => handle(input.files));
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("is-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("is-over"); handle(e.dataTransfer.files); });
    return zone;
  }

  function row(cat, item, i) {
    const list = draft[cat];
    const move = (to) => {
      if (to < 0 || to >= list.length) return;
      list.splice(to, 0, list.splice(i, 1)[0]); render();
    };
    const fields = el("div", { class: "sitem__fields" });
    if (cat === "wedding" && i === 0) fields.append(el("span", { class: "sbadge" }, "★ Main portrait"));
    if (cat === "gang") {
      fields.append(
        input("Name (optional)", item.name, (v) => (item.name = v)),
        input("Nickname / title", item.title, (v) => (item.title = v)),
        area("Personal wedding wish", item.wish, (v) => (item.wish = v)),
        input("Funny memory", item.memory, (v) => (item.memory = v))
      );
    } else {
      fields.append(input(cat === "wedding" ? "Caption (optional)" : "Funny caption", item.caption, (v) => (item.caption = v)));
    }
    const r = el("div", { class: "sitem", draggable: true },
      el("span", { class: "sitem__grip", title: "Drag to reorder" }, "⋮⋮"),
      el("img", { class: "sitem__thumb", src: item.src, alt: "" }),
      fields,
      el("div", { class: "sitem__actions" },
        el("button", { type: "button", title: "Move up", onclick: () => move(i - 1) }, "↑"),
        el("button", { type: "button", title: "Move down", onclick: () => move(i + 1) }, "↓"),
        cat === "wedding" && i > 0 ? el("button", { type: "button", title: "Make main portrait", onclick: () => move(0) }, "★") : null,
        el("button", { type: "button", title: "Remove", onclick: () => { list.splice(i, 1); render(); } }, "✕"))
    );
    // drag & drop reordering
    r.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", String(i)); r.classList.add("is-dragging"); });
    r.addEventListener("dragend", () => r.classList.remove("is-dragging"));
    r.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/plain")) { e.preventDefault(); r.classList.add("is-target"); } });
    r.addEventListener("dragleave", () => r.classList.remove("is-target"));
    r.addEventListener("drop", (e) => {
      e.preventDefault(); r.classList.remove("is-target");
      const from = Number(e.dataTransfer.getData("text/plain"));
      if (Number.isNaN(from) || from === i) return;
      list.splice(i, 0, list.splice(from, 1)[0]); render();
    });
    return r;
  }

  const input = (ph, val, set) => el("input", { type: "text", placeholder: ph, value: val || "", oninput: (e) => set(e.target.value) });
  const area = (ph, val, set) => el("textarea", { placeholder: ph, value: val || "", oninput: (e) => set(e.target.value) });

  function field(label, node) { return el("label", { class: "sfield" }, el("span", {}, label), node); }

  function renderWords() {
    const w = draft;
    body.append(
      field("Welcome heading", input("Hey Buddy!", w.welcome.heading, (v) => (w.welcome.heading = v))),
      field("Welcome line", input("", w.welcome.sub, (v) => (w.welcome.sub = v))),
      field("Letter greeting", input("Dear Buddy,", w.letter.greeting, (v) => (w.letter.greeting = v))),
      field("Letter message (typed out with animation)", area("", w.letter.body, (v) => (w.letter.body = v))),
      field("Letter sign-off", input("", w.letter.signoff, (v) => (w.letter.signoff = v))),
      field("Letter from", input("", w.letter.from, (v) => (w.letter.from = v))),
      field("Couple names", input("Mahesh & Navya", w.reveal.couple, (v) => (w.reveal.couple = v))),
      field("Reveal title", input("", w.reveal.title, (v) => (w.reveal.title = v))),
      field("Reveal headline", input("", w.reveal.headline, (v) => (w.reveal.headline = v))),
      field("Reveal message", area("", w.reveal.message, (v) => (w.reveal.message = v)))
    );
    const musicInput = el("input", { type: "file", accept: "audio/*" });
    musicInput.addEventListener("change", async () => {
      const f = musicInput.files[0]; if (!f) return;
      if (f.size > 12 * 1024 * 1024) { say("That song is over 12 MB — please pick a smaller mp3."); return; }
      say("Loading song…");
      w.music = await readAsDataURL(f);
      say(`Song "${f.name}" added. Save to use it.`); render();
    });
    body.append(field("Background music",
      el("div", {},
        el("p", { class: "snote" }, w.music ? "✓ A custom song is set." : "Using the built-in soft melody. Upload an mp3 to use your own song."),
        el("label", { class: "drop" }, el("strong", {}, "♪ Choose a song"), musicInput),
        w.music ? el("button", { class: "sbtn sbtn--danger", type: "button", onclick: () => { w.music = ""; render(); } }, "Remove custom song") : null)
    ));
  }

  /* ---------- wiring ---------- */
  root.querySelectorAll(".studio__tabs button").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
  document.getElementById("studioClose").addEventListener("click", () => close());
  root.addEventListener("click", (e) => { if (e.target === root) close(); });
  document.getElementById("studioSave").addEventListener("click", async () => {
    try {
      await saveData(draft);
      say("Saved ✓");
      onSaveCb && onSaveCb(JSON.parse(JSON.stringify(draft)));
      close();
    } catch (e) { say("Couldn't save in this browser: " + e.message); }
  });
  document.getElementById("studioReset").addEventListener("click", async () => {
    if (!confirm("Discard all your changes and go back to the original photos and text?")) return;
    await clearData().catch(() => {});
    draft = JSON.parse(JSON.stringify(defaults));
    onSaveCb && onSaveCb(JSON.parse(JSON.stringify(draft)));
    say("Reset ✓"); render();
  });
  document.getElementById("studioExport").addEventListener("click", () => {
    const js = "/* Generated by the Photo Studio. Replace js/data.js with this file. */\nwindow.SURPRISE_DATA = " + JSON.stringify(draft, null, 2) + ";\n";
    const a = el("a", { href: URL.createObjectURL(new Blob([js], { type: "text/javascript" })), download: "data.js" });
    document.body.append(a); a.click(); a.remove();
    say("data.js downloaded — put it in the js/ folder to share this version.");
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !root.hidden) close(); });

  function open(current, defaultData, onSave) {
    draft = JSON.parse(JSON.stringify(current));
    defaults = defaultData; onSaveCb = onSave;
    say(""); root.hidden = false; render();
  }
  function close() { root.hidden = true; }

  window.Studio = { open, loadSaved };
})();
