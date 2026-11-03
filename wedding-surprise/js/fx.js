/* =====================================================================
   FX — floating rose petals, golden sparkles, hearts and confetti
   drawn on one full-screen canvas.
   ===================================================================== */
(function () {
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = () => window.innerWidth < 720;

  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let ambient = { petals: 0, sparkles: 0, hearts: 0 };
  let running = true;
  let last = performance.now();

  const PETAL_COLORS = [["#f6c9cc", "#e08b95"], ["#f9dcd6", "#e9a3a6"], ["#f3c1c6", "#c9727a"], ["#fbe3dc", "#eab0ad"]];
  const CONFETTI = ["#f6e3b4", "#d8b267", "#c49a4c", "#fff6e0", "#f2d3cd", "#e7a5a8"];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);

  function make(kind, opts = {}) {
    const p = { kind, life: 0, ttl: opts.ttl || Infinity, ambient: !!opts.ambient };
    p.x = opts.x ?? rand(0, W);
    p.y = opts.y ?? rand(-H * 0.2, -20);
    p.rot = rand(0, Math.PI * 2);
    p.vr = rand(-1.2, 1.2);
    p.phase = rand(0, Math.PI * 2);
    switch (kind) {
      case "petal":
        p.size = rand(9, 17); p.vx = rand(-12, 18); p.vy = rand(28, 60);
        p.col = PETAL_COLORS[(Math.random() * PETAL_COLORS.length) | 0]; p.flip = rand(0.8, 2.2);
        break;
      case "sparkle":
        p.size = rand(1, 2.6); p.vx = rand(-6, 6); p.vy = rand(-14, -4);
        if (opts.y === undefined) p.y = rand(0, H);
        p.tw = rand(1.5, 4);
        break;
      case "heart":
        p.size = rand(8, 15); p.vx = rand(-8, 8); p.vy = rand(-40, -20);
        if (opts.y === undefined) p.y = H + rand(10, 80);
        p.col = Math.random() < 0.5 ? "#e7a5a8" : "#d8b267"; p.alpha = rand(0.35, 0.7);
        break;
      case "confetti":
        p.size = rand(5, 10); p.vx = opts.vx ?? rand(-60, 60); p.vy = opts.vy ?? rand(40, 120);
        p.col = CONFETTI[(Math.random() * CONFETTI.length) | 0]; p.shape = Math.random() < 0.35 ? "circle" : "rect";
        p.flip = rand(2, 6);
        break;
      case "burst":
        const a = rand(0, Math.PI * 2), s = rand(80, 340);
        p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 60; p.size = rand(1.5, 3.5); p.ttl = rand(1.2, 2.4);
        p.col = Math.random() < 0.7 ? "#f6e3b4" : "#f2d3cd";
        break;
    }
    return p;
  }

  function maintainAmbient() {
    const scale = small() ? 0.6 : 1;
    const want = {
      petal: Math.round(ambient.petals * scale),
      sparkle: Math.round(ambient.sparkles * scale),
      heart: Math.round(ambient.hearts * scale)
    };
    const have = { petal: 0, sparkle: 0, heart: 0 };
    for (const p of particles) if (p.ambient) have[p.kind]++;
    for (const k in want) {
      if (have[k] < want[k] && Math.random() < 0.25) {
        const p = make(k, { ambient: true });
        if (k === "petal" && particles.length < 5) p.y = rand(0, H);
        particles.push(p);
      }
    }
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.abs(Math.sin(p.life * p.flip + p.phase)) * 0.7 + 0.3);
    const g = ctx.createLinearGradient(-p.size, 0, p.size, 0);
    g.addColorStop(0, p.col[0]); g.addColorStop(1, p.col[1]);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.bezierCurveTo(p.size * 0.9, -p.size * 0.6, p.size * 0.7, p.size * 0.7, 0, p.size);
    ctx.bezierCurveTo(-p.size * 0.7, p.size * 0.7, -p.size * 0.9, -p.size * 0.6, 0, -p.size);
    ctx.fill();
    ctx.restore();
  }
  function drawHeart(p, alpha) {
    const s = p.size;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(p.life + p.phase) * 0.25);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(-s, -s * 0.4, -s * 0.45, -s * 1.1, 0, -s * 0.45);
    ctx.bezierCurveTo(s * 0.45, -s * 1.1, s, -s * 0.4, 0, s * 0.3);
    ctx.fill();
    ctx.restore();
  }
  function drawGlow(x, y, r, color, alpha) {
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, color); g.addColorStop(0.25, color); g.addColorStop(1, "rgba(246,227,180,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    ctx.clearRect(0, 0, W, H);
    if (!running) { requestAnimationFrame(frame); return; }
    maintainAmbient();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      let alpha = 1;
      switch (p.kind) {
        case "petal":
          p.x += (p.vx + Math.sin(p.life * 1.3 + p.phase) * 22) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          drawPetal(p);
          if (p.y > H + 30) particles.splice(i, 1);
          continue;
        case "sparkle":
          p.x += p.vx * dt + Math.sin(p.life + p.phase) * 0.2;
          p.y += p.vy * dt;
          alpha = 0.25 + 0.75 * Math.abs(Math.sin(p.life * p.tw + p.phase));
          drawGlow(p.x, p.y, p.size, "rgba(255,236,190,0.95)", alpha * 0.8);
          if (p.y < -20) particles.splice(i, 1);
          continue;
        case "heart":
          p.x += (p.vx + Math.sin(p.life * 1.6 + p.phase) * 14) * dt;
          p.y += p.vy * dt;
          drawHeart(p, p.alpha * Math.min(1, (H - p.y) / 200 + 0.2));
          if (p.y < -30) particles.splice(i, 1);
          continue;
        case "confetti":
          p.vy += 140 * dt; p.vy = Math.min(p.vy, 170);
          p.vx *= 0.985;
          p.x += (p.vx + Math.sin(p.life * 3 + p.phase) * 30) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * 3 * dt;
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.life * p.flip + p.phase));
          ctx.globalAlpha = 0.95; ctx.fillStyle = p.col;
          if (p.shape === "circle") { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
          else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          if (p.y > H + 20) particles.splice(i, 1);
          continue;
        case "burst":
          p.vx *= 0.96; p.vy = p.vy * 0.96 + 90 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          alpha = Math.max(0, 1 - p.life / p.ttl);
          drawGlow(p.x, p.y, p.size, p.col, alpha);
          if (p.life > p.ttl) particles.splice(i, 1);
          continue;
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", () => { running = !document.hidden; last = performance.now(); });

  window.FX = {
    setAmbient(cfg) {
      ambient = Object.assign({ petals: 0, sparkles: 0, hearts: 0 }, reduced ? { petals: Math.min(cfg.petals || 0, 6) } : cfg);
      for (const p of particles) {
        if (!p.ambient) continue;
        const key = p.kind + "s";
        if (!ambient[key]) p.ambient = false; // let it drift away naturally
      }
    },
    burst(x, y, n = 70) {
      if (reduced) n = Math.min(n, 15);
      for (let i = 0; i < n; i++) particles.push(make("burst", { x, y }));
    },
    confetti(n = 160) {
      if (reduced) n = 30;
      if (small()) n = Math.round(n * 0.6);
      for (let i = 0; i < n; i++) {
        const fromLeft = Math.random() < 0.5;
        particles.push(make("confetti", {
          x: fromLeft ? rand(-20, W * 0.15) : rand(W * 0.85, W + 20),
          y: rand(H * 0.3, H * 0.75),
          vx: fromLeft ? rand(80, 360) : rand(-360, -80),
          vy: rand(-420, -160)
        }));
      }
    },
    rainPetals(n = 50) {
      for (let i = 0; i < n; i++) particles.push(make("petal", { y: rand(-H * 0.6, -10) }));
    },
    hearts(n = 20) {
      for (let i = 0; i < n; i++) particles.push(make("heart", { y: H + rand(10, 300) }));
    },
    clear() { particles = []; }
  };
})();
