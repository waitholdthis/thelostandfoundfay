/* The Lost and Found Thrift Shoppe — Drawer of the Day, Shop Map, St. Jude total, Lost & Found Board.
   Content comes from the Google Sheet (via config.sheetApi) or, until that's connected, data/site-data.json. */
(function () {
  "use strict";

  var config = window.SHOPPE_CONFIG || {};
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isDemo = /[?&]demo\b/.test(location.search);
  var isPractice = /[?&]practice\b/.test(location.search);

  // Keep a copy of every line drawing before the New Finds grid is replaced with real items
  var sketchBank = {};
  Array.prototype.forEach.call(document.querySelectorAll("svg[data-sketch]"), function (svg) {
    var copy = svg.cloneNode(true);
    copy.removeAttribute("data-sketch");
    copy.removeAttribute("role");
    copy.removeAttribute("aria-label");
    copy.setAttribute("aria-hidden", "true");
    sketchBank[svg.getAttribute("data-sketch")] = copy;
  });
  function sketchSvg(key) {
    var s = sketchBank[key] || sketchBank.teacups;
    return s ? s.cloneNode(true) : document.createDocumentFragment();
  }

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text); // never innerHTML: board content comes from the public
    return node;
  }

  // Today's date in the shoppe's time zone, as YYYY-MM-DD
  function todayKey() {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone || "America/New_York" }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function parseDay(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key || ""));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }

  function formatDay(key, opts) {
    var d = parseDay(key);
    return d ? d.toLocaleDateString("en-US", Object.assign({ timeZone: "UTC" }, opts)) : "";
  }

  var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  /* ---------- Load content ---------- */
  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + url);
      return r.json();
    });
  }

  // Practice mode: show what was saved in the Shoppe Office on this browser (admin.html)
  function practiceData() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem("lf-practice-v1") || "null"); } catch (e) { /* ignore */ }
    if (!d) return null;
    return {
      impact: d.impact,
      finds: (d.finds || []).filter(function (f) { return f.show; }).slice(0, 6)
        .map(function (f) { return { title: f.title, label: f.label, description: f.description, price: f.price, image: f.photo, sketch: f.sketch }; }),
      drawer: (d.drawer || []).map(function (x) { return Object.assign({}, x, { image: x.photo }); }),
      map: d.map,
      lost: (d.lost || []).filter(function (c) { return c.status === "looking" || c.status === "found"; })
        .map(function (c) { return { name: c.name, item: c.item, details: c.details, status: c.status, posted: c.posted, foundNote: c.foundNote }; })
    };
  }

  function loadData() {
    if (isPractice && practiceData()) return Promise.resolve(practiceData());
    if (isDemo) return fetchJson(config.demoFile || "data/demo-data.json");
    if (config.sheetApi) {
      return fetchJson(config.sheetApi).catch(function (err) {
        console.warn("Sheet unavailable, falling back to local data:", err);
        return fetchJson(config.dataFile || "data/site-data.json");
      });
    }
    return fetchJson(config.dataFile || "data/site-data.json");
  }

  /* ==========================================================================
     St. Jude running total
     ========================================================================== */
  function renderImpact(impact) {
    var box = $("impact-total");
    if (!box || !impact) return;
    var total = Math.max(0, Number(impact.total) || 0);
    var next = Math.max(0, Number(impact.nextMilestone) || 0);
    box.hidden = false;

    if (total === 0) {
      $("impact-amount").hidden = true;
      $("impact-zero").hidden = false;
      return;
    }

    if (impact.asOf) $("impact-asof").textContent = "Updated " + formatDay(impact.asOf, { month: "long", day: "numeric", year: "numeric" });

    // Milestone sprig: ten leaves, filled in proportion to the next milestone
    var leaves = 10, filled = 0;
    if (next > total) {
      filled = Math.floor((total / next) * leaves);
      $("impact-next").textContent = "Next milestone: " + money.format(next) + " — " + Math.floor((total / next) * 100) + "% of the way there";
    } else if (next) {
      filled = leaves;
      $("impact-next").textContent = "Milestone of " + money.format(next) + " reached — thank you!";
    }
    if (next) {
      drawSprig($("impact-sprig"), leaves, filled);
      $("impact-milestone").hidden = false;
    }

    // Count up when the figure scrolls into view
    var figure = $("impact-amount");
    figure.textContent = money.format(reduceMotion ? total : 0);
    if (reduceMotion || !("IntersectionObserver" in window)) {
      figure.textContent = money.format(total);
      box.classList.add("is-counted");
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      var start = performance.now(), dur = 1800;
      (function step(now) {
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        figure.textContent = money.format(Math.round(total * eased));
        if (t < 1) requestAnimationFrame(step);
        else box.classList.add("is-counted");
      })(start);
    }, { threshold: 0.5 });
    io.observe(figure);
  }

  function drawSprig(svg, count, filled) {
    var ns = "http://www.w3.org/2000/svg";
    var stem = document.createElementNS(ns, "path");
    stem.setAttribute("d", "M8 44 C100 40 200 30 312 14");
    stem.setAttribute("class", "sprig-stem");
    svg.appendChild(stem);
    for (var i = 0; i < count; i++) {
      var x = 26 + i * 29, y = 43 - i * 2.8;
      var leaf = document.createElementNS(ns, "path");
      leaf.setAttribute("d", "M0 0 c4 -11 14 -15 23 -13 c-4 10 -12 14 -23 13z");
      var flip = i % 2 ? " scale(1 -1)" : "";
      leaf.setAttribute("transform", "translate(" + x + " " + y + ") rotate(-14)" + flip);
      leaf.setAttribute("class", "sprig-leaf" + (i < filled ? " is-filled" : ""));
      leaf.style.transitionDelay = (0.2 + i * 0.12) + "s";
      svg.appendChild(leaf);
    }
  }

  /* ==========================================================================
     Drawer of the Day
     ========================================================================== */
  function pickDrawerItem(items, today) {
    if (!items || !items.length) return null;
    for (var i = 0; i < items.length; i++) if (items[i].date && String(items[i].date).slice(0, 10) === today) return items[i];
    var undated = items.filter(function (it) { return !it.date; });
    if (!undated.length) return null;
    var dayNumber = Math.floor(parseDay(today).getTime() / 86400000);
    return undated[dayNumber % undated.length];
  }

  function sketchFor(item) {
    var wrap = document.createDocumentFragment();
    if (item && item.image) {
      var img = el("img");
      img.src = item.image; img.alt = item.title || "Today's find"; img.loading = "lazy";
      wrap.appendChild(img);
      return wrap;
    }
    var key = (item && item.sketch) || "teacups";
    if (key === "chair") {
      var chair = el("img");
      chair.src = "assets/vignette-chair.jpg"; chair.alt = ""; chair.className = "is-engraving";
      wrap.appendChild(chair);
      return wrap;
    }
    wrap.appendChild(sketchSvg(key));
    return wrap;
  }

  /* ==========================================================================
     New Finds (items added in the Shoppe Office). Placeholders stay until there are some.
     ========================================================================== */
  function renderFinds(finds) {
    var grid = document.querySelector(".finds__grid");
    if (!grid || !finds || !finds.length) return;
    grid.textContent = "";
    finds.slice(0, 6).forEach(function (f) {
      var fig = el("figure", "find framed");
      if (f.image) {
        var img = el("img", "find__photo");
        img.src = f.image; img.alt = f.title || ""; img.loading = "lazy"; img.decoding = "async";
        fig.appendChild(img);
      } else {
        fig.appendChild(sketchFor({ sketch: f.sketch }));
        var art = fig.lastChild;
        if (art && art.setAttribute) { art.setAttribute("role", "img"); art.setAttribute("aria-label", f.title || ""); art.removeAttribute("aria-hidden"); }
      }
      var cap = el("figcaption");
      if (f.label) cap.appendChild(el("span", "", f.label));
      cap.appendChild(document.createTextNode(f.title || ""));
      if (f.price) cap.appendChild(el("em", "find__price", f.price));
      fig.appendChild(cap);
      if (f.description) fig.title = f.description;
      grid.appendChild(fig);
    });
  }

  function renderDrawer(items) {
    var stage = $("drawer-stage"), btn = $("drawer-open"), card = $("drawer-card");
    if (!stage || !btn) return;
    var today = todayKey();
    $("drawer-date").textContent = formatDay(today, { weekday: "long", month: "long", day: "numeric" });

    var item = pickDrawerItem(items, today);
    $("drawer-art").appendChild(sketchFor(item));
    if (item) {
      $("drawer-era").textContent = item.era || "Today’s find";
      $("drawer-item").textContent = item.title || "";
      $("drawer-desc").textContent = item.description || "";
      $("drawer-price").textContent = item.price || "";
    } else {
      card.classList.add("is-empty");
      $("drawer-era").textContent = "Being restocked";
      $("drawer-item").textContent = "Something special is on its way";
      $("drawer-desc").textContent = "We’re choosing tomorrow’s treasure. Peek back in the morning.";
    }

    function setOpen(open) {
      stage.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Close the drawer" : "Open the drawer";
      if (open) card.hidden = false;
      else setTimeout(function () { if (!stage.classList.contains("is-open")) card.hidden = true; }, reduceMotion ? 0 : 700);
    }
    btn.addEventListener("click", function () { setOpen(!stage.classList.contains("is-open")); });
    stage.querySelector(".drawer-front").addEventListener("click", function () { setOpen(!stage.classList.contains("is-open")); });
  }

  /* ==========================================================================
     Shop Map
     ========================================================================== */
  function renderMap(zones) {
    var plan = $("plan"), legend = $("map-legend");
    if (!plan || !legend) return;
    var byZone = {};
    (zones || []).forEach(function (z) { byZone[z.zone] = z; });
    var featured = (zones || []).filter(function (z) { return z.featured === true || String(z.featured).toLowerCase() === "true"; })[0];

    // Mark this week's corner with the fleur-de-lis
    var fleur = $("plan-fleur");
    plan.querySelectorAll(".zone").forEach(function (g) { g.classList.remove("is-featured"); });
    if (featured) {
      var g = plan.querySelector('.zone[data-zone="' + featured.zone + '"]');
      var area = g && g.querySelector(".zone__area");
      if (area) {
        g.classList.add("is-featured");
        fleur.setAttribute("x", +area.getAttribute("x") + +area.getAttribute("width") - 38);
        fleur.setAttribute("y", +area.getAttribute("y") + 8);
        fleur.classList.add("is-shown");
      }
      var btn = legend.querySelector('[data-zone="' + featured.zone + '"]');
      if (btn) btn.classList.add("is-featured");
    }

    function select(id) {
      var z = byZone[id];
      var label = legend.querySelector('[data-zone="' + id + '"]');
      $("map-zone-title").textContent = (z && z.title) || (label ? label.textContent.replace(/^\d+/, "") : "");
      $("map-zone-blurb").textContent = (z && z.blurb) || "";
      $("map-badge").hidden = !(featured && featured.zone === id);
      plan.querySelectorAll(".zone").forEach(function (g) { g.classList.toggle("is-active", g.getAttribute("data-zone") === id); });
      legend.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-zone") === id)); });
    }

    legend.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { select(b.getAttribute("data-zone")); });
    });
    plan.querySelectorAll(".zone").forEach(function (g) {
      g.addEventListener("click", function () { select(g.getAttribute("data-zone")); });
    });

    if (featured) select(featured.zone);
  }

  /* ==========================================================================
     Lost & Found Board
     ========================================================================== */
  function renderBoard(entries) {
    var list = $("lost-cards"), empty = $("lost-empty");
    if (!list) return;
    var cards = (entries || []).slice().sort(function (a, b) {
      if ((a.status === "found") !== (b.status === "found")) return a.status === "found" ? 1 : -1;
      return String(b.posted || "").localeCompare(String(a.posted || ""));
    });

    list.textContent = "";
    cards.forEach(function (c, i) {
      var found = String(c.status).toLowerCase() === "found";
      var li = el("li", "lost-card" + (found ? " is-found" : ""));
      li.setAttribute("data-status", found ? "found" : "looking");
      li.style.setProperty("--tilt", ([-1.4, 1, -0.6, 1.5, -1, 0.7][i % 6]) + "deg");
      li.appendChild(el("span", "lost-card__label", found ? "Found" : "Looking for"));
      li.appendChild(el("h3", "lost-card__item", c.item));
      if (c.details) li.appendChild(el("p", "lost-card__details", c.details));
      if (found && c.foundNote) li.appendChild(el("p", "lost-card__note", c.foundNote));
      var by = "— " + (c.name || "A shopper");
      if (c.posted) by += " · " + formatDay(c.posted, { month: "short", day: "numeric" });
      li.appendChild(el("p", "lost-card__by", by));
      if (found) {
        var stamp = el("span", "lost-card__stamp", "Found");
        stamp.setAttribute("aria-hidden", "true");
        li.appendChild(stamp);
      }
      list.appendChild(li);
    });
    empty.hidden = cards.length > 0;

    // Filters
    var filters = document.querySelectorAll(".lost__filters button");
    filters.forEach(function (b) {
      b.addEventListener("click", function () {
        var f = b.getAttribute("data-filter");
        filters.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        var shown = 0;
        list.querySelectorAll(".lost-card").forEach(function (li) {
          var show = f === "all" || li.getAttribute("data-status") === f;
          li.hidden = !show;
          if (show) shown++;
        });
        if (!cards.length) return; // keep the "waiting for its first card" message
        empty.hidden = shown > 0;
        if (!shown) {
          empty.textContent = f === "found" ? "Nothing stamped found just yet—but we’re looking." : "Everything on the board has been found!";
        }
      });
    });
  }

  function initLostForm() {
    var form = $("lost-form"), status = $("lost-status");
    if (!form) return;

    function say(msg, kind) {
      status.textContent = msg;
      status.className = "lost__status" + (kind ? " is-" + kind : "");
    }

    function viaEmail(card) {
      var body = [
        "Please pin this card to the Lost & Found Board:",
        "",
        "Name: " + card.firstName + (card.lastInitial ? " " + card.lastInitial + "." : ""),
        "Email: " + card.email,
        "Looking for: " + card.item,
        "Details: " + (card.details || "—")
      ].join("\n");
      location.href = "mailto:" + (config.shopEmail || "") +
        "?subject=" + encodeURIComponent("Lost & Found Board: " + card.item) +
        "&body=" + encodeURIComponent(body);
      say("Your email app should open with your card filled in—just press send and we’ll pin it up.", "ok");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      // Bots fill in the hidden field; quietly pretend all is well
      if (data.get("website")) { form.reset(); say("Thank you! Your card is on its way to the board.", "ok"); return; }

      var card = {
        firstName: String(data.get("firstName") || "").trim(),
        lastInitial: String(data.get("lastInitial") || "").trim().slice(0, 1).toUpperCase(),
        email: String(data.get("email") || "").trim(),
        item: String(data.get("item") || "").trim(),
        details: String(data.get("details") || "").trim()
      };

      if (!config.sheetApi || isDemo) { viaEmail(card); return; }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      say("Pinning your card…");
      // text/plain avoids a CORS preflight, which Apps Script web apps don't answer
      fetch(config.sheetApi, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(card) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || "Not saved");
          form.reset();
          say("Thank you! Your card is with us. Once the shoppe gives it a quick look, it’ll be pinned to the board, and we’ll email you the moment it turns up.", "ok");
        })
        .catch(function (err) {
          console.warn("Board submission failed:", err);
          say("We couldn’t reach the board just now, so we’ll send your card by email instead.", "warn");
          viaEmail(card);
        })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ---------- Go ---------- */
  initLostForm();
  loadData()
    .catch(function (err) {
      console.warn("Could not load site data:", err);
      return {};
    })
    .then(function (data) {
      renderFinds(data.finds);
      renderImpact(data.impact);
      renderDrawer(data.drawer || []);
      renderMap(data.map || []);
      renderBoard(data.lost || []);
    });
})();
