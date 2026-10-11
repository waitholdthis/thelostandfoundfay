/* The Lost and Found Thrift Shoppe — interactions */
(function () {
  "use strict";

  document.documentElement.classList.remove("no-js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Navigation ---------- */
  var nav = document.getElementById("site-nav");
  var toggle = nav.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");

  function onScroll() {
    nav.classList.toggle("is-scrolled", window.scrollY > window.innerHeight * 0.35);
    document.body.classList.toggle("past-hero", window.scrollY > window.innerHeight * 0.75);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    links.classList.toggle("is-open", open);
  }
  toggle.addEventListener("click", function () {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });
  links.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });
  // Close the phone menu on an outside tap, or when rotating/resizing past the breakpoint
  document.addEventListener("click", function (e) {
    if (links.classList.contains("is-open") && !nav.contains(e.target)) setMenu(false);
  });
  window.matchMedia("(max-width: 720px)").addEventListener("change", function () { setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.classList.add("is-visible");
          io.unobserve(el);
          // Drop the stagger once revealed so hover transitions stay snappy
          el.addEventListener("transitionend", function () { el.style.transitionDelay = ""; }, { once: true });
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealEls.forEach(function (el, i) {
      // Stagger the hero title sequence
      if (el.closest(".hero")) el.style.transitionDelay = (0.6 + i * 0.18) + "s";
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Dust motes in the window light ---------- */
  var canvas = document.getElementById("dust");
  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext("2d");
    var motes = [];
    var w = 0, h = 0, dpr = 1, running = true;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(90, (w * h) / 14000));
      motes = [];
      for (var i = 0; i < count; i++) motes.push(makeMote(true));
    }
    function makeMote(anywhere) {
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 10,
        r: Math.random() * 1.8 + 0.4,
        vx: (Math.random() - 0.3) * 0.12,
        vy: -(Math.random() * 0.18 + 0.03),
        phase: Math.random() * Math.PI * 2,
        twinkle: Math.random() * 0.02 + 0.006
      };
    }
    // Motes glow brighter inside the diagonal sunbeam band
    function beam(x, y) {
      var d = (x / w) - (y / h) * 0.55 - 0.18;
      return Math.max(0, 1 - Math.abs(d) * 3.2);
    }
    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.phase += m.twinkle;
        m.x += m.vx + Math.sin(m.phase) * 0.15;
        m.y += m.vy + Math.cos(m.phase * 0.7) * 0.05;
        if (m.y < -10 || m.x < -10 || m.x > w + 10) motes[i] = m = makeMote(false);
        var a = (0.10 + beam(m.x, m.y) * 0.45) * (0.6 + Math.sin(m.phase) * 0.4);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(168, 136, 98," + a.toFixed(3) + ")";
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    // Pause when the hero is off-screen
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        var visible = entries[0].isIntersecting;
        if (visible && !running) { running = true; requestAnimationFrame(tick); }
        else if (!visible) running = false;
      }).observe(canvas);
    }
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(tick);
  }

  /* ---------- "Open now" stamp on the hours card (shop time: America/New_York) ---------- */
  var stamp = document.getElementById("open-stamp");
  if (stamp && window.Intl) {
    try {
      var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", weekday: "short", hour: "numeric", hour12: false
      }).formatToParts(new Date());
      var day = "", hour = 0;
      parts.forEach(function (p) {
        if (p.type === "weekday") day = p.value;
        if (p.type === "hour") hour = parseInt(p.value, 10) % 24;
      });
      var open = day !== "Sun" && hour >= 10 && hour < 16;
      stamp.textContent = open ? "Open now" : "Closed now";
      stamp.classList.add(open ? "is-open" : "is-closed");
      stamp.hidden = false;
    } catch (e) { /* leave hidden */ }
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Ambience: synthesised vinyl crackle + warm room tone ---------- */
  var btn = document.getElementById("ambience");
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (btn && AudioCtx) {
    setTimeout(function () { btn.classList.add("is-ready"); }, 2600);
    var actx = null, master = null;

    function build() {
      actx = new AudioCtx();
      master = actx.createGain();
      master.gain.value = 0;
      master.connect(actx.destination);

      var len = actx.sampleRate * 4;

      // Room tone: soft brown noise, low-passed
      var roomBuf = actx.createBuffer(1, len, actx.sampleRate);
      var rd = roomBuf.getChannelData(0), last = 0;
      for (var i = 0; i < len; i++) {
        var white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        rd[i] = last * 3.2;
      }
      var room = actx.createBufferSource();
      room.buffer = roomBuf; room.loop = true;
      var lp = actx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 420;
      var roomGain = actx.createGain(); roomGain.gain.value = 0.55;
      room.connect(lp).connect(roomGain).connect(master);
      room.start();

      // Crackle: sparse clicks, band-passed
      var crackBuf = actx.createBuffer(1, len, actx.sampleRate);
      var cd = crackBuf.getChannelData(0);
      for (var j = 0; j < len; j++) {
        if (Math.random() < 0.00045) {
          var amp = Math.random() * 0.7 + 0.1;
          for (var k = 0; k < 40 && j + k < len; k++) cd[j + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / 6);
        }
      }
      var crackle = actx.createBufferSource();
      crackle.buffer = crackBuf; crackle.loop = true;
      var bp = actx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.7;
      var crackGain = actx.createGain(); crackGain.gain.value = 0.35;
      crackle.connect(bp).connect(crackGain).connect(master);
      crackle.start();
    }

    btn.addEventListener("click", function () {
      var on = btn.getAttribute("aria-pressed") !== "true";
      if (!actx) build();
      if (actx.state === "suspended") actx.resume();
      var now = actx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(on ? 0.12 : 0, now + 1.2);
      btn.setAttribute("aria-pressed", String(on));
    });
  }
})();
