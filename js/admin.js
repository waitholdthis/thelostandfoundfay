/* Shoppe Office: the admin page for The Lost and Found Thrift Shoppe.
   Saves to the Google Sheet (config.sheetApi), or to this browser in practice mode. */
(function () {
  "use strict";

  var config = window.SHOPPE_CONFIG || {};
  var practice = !config.sheetApi;
  var PRACTICE_KEY = "lf-practice-v1";
  var PASS_KEY = "lf-office-passcode";
  var SKETCH_NAMES = { lamp: "Lamp", denim: "Denim jacket", books: "Books", ceramics: "Ceramics", glass: "Glassware", vinyl: "Record player", teacups: "Teacups", chair: "Armchair" };
  var ZONE_NAMES = { window: "Front Window", glassware: "Glassware & Kitchen", linens: "Linens & Textiles", furniture: "Furniture & Décor", donations: "Donation Drop-off", books: "Books & Records", clothing: "Clothing & Denim", counter: "Checkout & Coffee" };

  var state = null;
  var passcode = "";
  try { passcode = sessionStorage.getItem(PASS_KEY) || ""; } catch (e) { /* private mode */ }

  /* ---------- Small helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function button(label, className, onClick) {
    var b = el("button", "btn-small" + (className ? " " + className : ""), label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  function todayKey() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone || "America/New_York" }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function niceDay(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key || "");
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "";
  }
  var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var toastTimer;
  function toast(msg, isError) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast is-shown" + (isError ? " is-error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, isError ? 6000 : 3200);
  }

  /* ==========================================================================
     Back ends
     ========================================================================== */
  function sheetCall(action, payload) {
    return fetch(config.sheetApi, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids a CORS preflight
      body: JSON.stringify(Object.assign({ action: action, passcode: passcode }, payload || {}))
    })
      .then(function (r) { return r.json(); }, function () {
        throw new Error("Couldn’t reach the Google Sheet. Check the internet connection and try again.");
      })
      .then(function (res) {
        if (!res.ok) {
          var err = new Error(res.error || "Something went wrong.");
          err.auth = res.auth;
          throw err;
        }
        return res;
      });
  }

  var Practice = {
    read: function () {
      try { return JSON.parse(localStorage.getItem(PRACTICE_KEY) || "null"); } catch (e) { return null; }
    },
    write: function (d) {
      try { localStorage.setItem(PRACTICE_KEY, JSON.stringify(d)); }
      catch (e) { throw new Error("This browser is out of practice space. Try fewer photos, or start over with sample items."); }
    },
    seed: function () {
      return fetch(config.demoFile || "data/demo-data.json", { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (demo) {
          var day = 86400000, now = Date.now();
          var d = {
            impact: demo.impact,
            map: demo.map,
            finds: (demo.finds || []).map(function (f, i) {
              return { id: newId() + i, added: new Date(now - i * day).toISOString(), title: f.title, label: f.label, description: f.description || "", price: f.price || "", photo: "", sketch: f.sketch || "", show: true };
            }),
            drawer: (demo.drawer || []).map(function (x, i) {
              return { id: newId() + i, date: x.date || "", title: x.title, era: x.era || "", description: x.description || "", price: x.price || "", sketch: x.sketch || "teacups", photo: x.image || "" };
            }),
            lost: (demo.lost || []).map(function (c, i) {
              return { id: newId() + i, posted: c.posted, name: c.name, email: "shopper@example.com", item: c.item, details: c.details || "", status: c.status, foundNote: c.foundNote || "", notified: c.status === "found" };
            })
          };
          d.lost.unshift({ id: newId(), posted: todayKey(), name: "Avery L.", email: "shopper@example.com", item: "Cast-iron skillet, 10 inch", details: "Seasoned is a bonus!", status: "pending", foundNote: "", notified: false });
          Practice.write(d);
          return d;
        });
    },
    call: function (action, p) {
      return new Promise(function (resolve) {
        var d = Practice.read();
        function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; return -1; }
        function upsert(list, item, extra) {
          var i = byId(list, item.id);
          if (i >= 0) list[i] = Object.assign({}, list[i], item);
          else list.push(Object.assign({ id: newId() }, extra || {}, item));
        }
        switch (action) {
          case "saveFind":
            upsert(d.finds, p.item, { added: new Date().toISOString() });
            d.finds.sort(function (a, b) { return String(b.added).localeCompare(String(a.added)); });
            break;
          case "deleteFind": if (byId(d.finds, p.id) >= 0) d.finds.splice(byId(d.finds, p.id), 1); break;
          case "saveDrawer": upsert(d.drawer, p.item); break;
          case "deleteDrawer": if (byId(d.drawer, p.id) >= 0) d.drawer.splice(byId(d.drawer, p.id), 1); break;
          case "saveImpact": d.impact = { total: Math.max(0, Math.round(+p.total || 0)), asOf: todayKey(), nextMilestone: Math.max(0, Math.round(+p.nextMilestone || 0)) }; break;
          case "saveMap": d.map = p.zones; break;
          case "setLostStatus":
            var c = d.lost[byId(d.lost, p.id)];
            if (c) {
              c.status = p.status;
              if (p.foundNote != null) c.foundNote = p.foundNote;
              if (p.status === "found") c.notified = true;
            }
            break;
          case "deleteLost": if (byId(d.lost, p.id) >= 0) d.lost.splice(byId(d.lost, p.id), 1); break;
          case "uploadPhoto": resolve({ ok: true, url: p.dataUrl }); return;
        }
        Practice.write(d);
        resolve({ ok: true, data: d });
      });
    }
  };

  function call(action, payload) {
    return practice ? Practice.call(action, payload) : sheetCall(action, payload);
  }

  // Run a change, refresh the screen from the result, and report back
  function act(action, payload, okMsg, btn) {
    if (btn) btn.disabled = true;
    return call(action, payload)
      .then(function (res) {
        if (res.data) { state = res.data; renderAll(); }
        if (okMsg) toast(okMsg);
        return res;
      })
      .catch(function (err) {
        if (err.auth) { signOut(err.message); return; }
        toast(err.message || "Couldn’t save. Please try again.", true);
        throw err;
      })
      .then(function (r) { if (btn) btn.disabled = false; return r; }, function (e) { if (btn) btn.disabled = false; throw e; });
  }

  /* ==========================================================================
     Sign in / start
     ========================================================================== */
  function showOffice() {
    $("loading").hidden = true;
    $("login").hidden = true;
    $("office").hidden = false;
    renderAll();
  }

  function signOut(message) {
    try { sessionStorage.removeItem(PASS_KEY); } catch (e) { /* ignore */ }
    passcode = "";
    state = null;
    $("office").hidden = true;
    $("sign-out").hidden = true;
    $("login").hidden = false;
    $("loading").hidden = true;
    $("login-error").textContent = message || "";
    $("passcode").focus();
  }

  function start() {
    var mode = $("office-mode");
    mode.hidden = false;
    if (practice) {
      mode.textContent = "Practice mode";
      mode.classList.add("is-practice");
      $("practice-note").hidden = false;
      $("view-site").href = "./?practice";
      var existing = Practice.read();
      (existing ? Promise.resolve(existing) : Practice.seed())
        .then(function (d) { state = d; showOffice(); })
        .catch(function () { $("loading").textContent = "Couldn’t open practice mode. Is the site running from a web server?"; });
      return;
    }
    mode.textContent = "Connected to Google Sheet";
    if (!passcode) { signOut(); return; }
    sheetCall("adminLoad")
      .then(function (res) { state = res.data; $("sign-out").hidden = false; showOffice(); })
      .catch(function (err) { signOut(err.auth ? "" : err.message); });
  }

  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = e.target.querySelector("button");
    passcode = $("passcode").value.trim().toUpperCase();
    $("login-error").textContent = "";
    btn.disabled = true;
    sheetCall("adminLoad")
      .then(function (res) {
        try { sessionStorage.setItem(PASS_KEY, passcode); } catch (er) { /* ignore */ }
        state = res.data;
        $("sign-out").hidden = false;
        $("passcode").value = "";
        showOffice();
      })
      .catch(function (err) { $("login-error").textContent = err.message; })
      .then(function () { btn.disabled = false; });
  });
  $("sign-out").addEventListener("click", function () { signOut(); });
  $("practice-reset").addEventListener("click", function () {
    if (!confirm("Erase your practice changes and start over with the sample items?")) return;
    Practice.seed().then(function (d) { state = d; renderAll(); toast("Practice items restored."); });
  });

  /* ==========================================================================
     Tabs
     ========================================================================== */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
    try { sessionStorage.setItem("lf-office-tab", tab.id); } catch (e) { /* ignore */ }
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { selectTab(t); });
    t.addEventListener("keydown", function (e) {
      var next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
      if (next == null) return;
      var target = tabs[(next + tabs.length) % tabs.length];
      selectTab(target);
      target.focus();
    });
  });
  try { var savedTab = $(sessionStorage.getItem("lf-office-tab")); if (savedTab) selectTab(savedTab); } catch (e) { /* ignore */ }

  /* ==========================================================================
     Photo picker (resizes on the device, then uploads)
     ========================================================================== */
  function loadImage(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return createImageBitmap(file); });
    }
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  function resize(file, maxSide, quality) {
    return loadImage(file).then(function (img) {
      var w = img.width, h = img.height, scale = Math.min(1, maxSide / Math.max(w, h));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    });
  }

  function setupPicker(form) {
    var picker = form.querySelector(".photo-picker");
    var input = picker.querySelector(".photo-picker__input");
    var preview = picker.querySelector(".photo-picker__preview");
    var removeBtn = picker.querySelector(".photo-picker__remove");
    var hidden = picker.querySelector('input[name="photo"]');
    var cta = picker.querySelector(".photo-picker__cta");
    var submit = form.querySelector('button[type="submit"]');

    function show(url) {
      hidden.value = url || "";
      preview.hidden = !url;
      removeBtn.hidden = !url;
      if (url) preview.src = url; else preview.removeAttribute("src");
    }
    picker.setPhoto = show;

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast("Please choose a photo.", true); return; }
      cta.textContent = "Preparing photo…";
      submit.disabled = true;
      resize(file, practice ? 900 : 1600, practice ? 0.75 : 0.82)
        .then(function (dataUrl) {
          preview.src = dataUrl; preview.hidden = false;
          if (practice) return { url: dataUrl };
          cta.textContent = "Uploading…";
          return sheetCall("uploadPhoto", { data: dataUrl.split(",")[1], mimeType: "image/jpeg", name: file.name });
        })
        .then(function (res) {
          hidden.value = res.url;
          removeBtn.hidden = false;
          toast("Photo ready.");
        })
        .catch(function (err) {
          show("");
          toast(err.message || "That photo couldn’t be used. Try another?", true);
        })
        .then(function () {
          cta.textContent = "Take or choose a different photo";
          submit.disabled = false;
          input.value = "";
        });
    });
    removeBtn.addEventListener("click", function () { show(""); cta.textContent = "Take or choose a photo"; });
  }

  /* ---------- Shared form helpers ---------- */
  function formValues(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (f) {
      if (!f.name || f.type === "file" || f.type === "radio") return;
      out[f.name] = f.type === "checkbox" ? f.checked : f.value.trim();
    });
    return out;
  }
  function fillForm(form, item) {
    Array.prototype.forEach.call(form.elements, function (f) {
      if (!f.name || f.type === "file" || !(f.name in item)) return;
      if (f.type === "checkbox") f.checked = !!item[f.name];
      else f.value = item[f.name] == null ? "" : item[f.name];
    });
    form.querySelector(".photo-picker").setPhoto(item.photo || "");
  }
  function resetForm(form, title) {
    form.reset();
    form.querySelector('input[name="id"]').value = "";
    form.querySelector(".photo-picker").setPhoto("");
    form.querySelector(".photo-picker__cta").textContent = "Take or choose a photo";
    form.querySelector("[data-cancel]").hidden = true;
    form.querySelector("h2").textContent = title;
  }
  function editInForm(form, item, title) {
    fillForm(form, item);
    form.querySelector("[data-cancel]").hidden = false;
    form.querySelector("h2").textContent = title;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.querySelector('input[name="title"]').focus({ preventScroll: true });
  }

  function thumb(item) {
    var box = el("div", "office-item__thumb");
    if (item.photo) {
      var img = el("img");
      img.src = item.photo; img.alt = ""; img.loading = "lazy";
      box.appendChild(img);
    } else {
      box.appendChild(el("span", "office-item__sketch", item.sketch ? "Drawing: " + (SKETCH_NAMES[item.sketch] || item.sketch) : "No photo"));
    }
    return box;
  }

  /* ==========================================================================
     New Finds
     ========================================================================== */
  var findForm = $("find-form");
  setupPicker(findForm);
  findForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = formValues(findForm);
    if (!v.photo && !v.sketch) { toast("Add a photo, or choose a drawing to show.", true); return; }
    act("saveFind", { item: v }, v.id ? "Find updated." : "Find added to the website.", findForm.querySelector('button[type="submit"]'))
      .then(function () { resetForm(findForm, "Add a new find"); });
  });
  findForm.querySelector("[data-cancel]").addEventListener("click", function () { resetForm(findForm, "Add a new find"); });

  function renderFinds() {
    var list = $("find-list");
    list.textContent = "";
    var shown = 0;
    if (!state.finds.length) list.appendChild(el("li", "office-empty", "No finds yet. Add your first one!"));
    state.finds.forEach(function (f) {
      var onSite = f.show && shown < 6;
      if (f.show) shown++;
      var li = el("li", "office-item" + (f.show ? "" : " is-muted"));
      li.appendChild(thumb(f));
      var body = el("div", "office-item__body");
      body.appendChild(el("p", "office-item__meta", [f.label, f.price].filter(Boolean).join(" · ")));
      body.appendChild(el("h3", "office-item__title", f.title));
      if (f.description) body.appendChild(el("p", "office-item__desc", f.description));
      body.appendChild(el("span", "chip " + (onSite ? "chip--on" : "chip--off"), onSite ? "On the website" : f.show ? "Waiting (only 6 show)" : "Hidden"));
      li.appendChild(body);
      var actions = el("div", "office-item__actions");
      actions.appendChild(button("Edit", "", function () { editInForm(findForm, f, "Edit find"); }));
      actions.appendChild(button(f.show ? "Hide" : "Show", "", function (e) {
        act("saveFind", { item: Object.assign({}, f, { show: !f.show }) }, f.show ? "Hidden from the website." : "Showing on the website.", e.target);
      }));
      actions.appendChild(button("Delete", "is-danger", function (e) {
        if (confirm("Delete “" + f.title + "”?")) act("deleteFind", { id: f.id }, "Find deleted.", e.target);
      }));
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  /* ==========================================================================
     Drawer of the Day
     ========================================================================== */
  var drawerForm = $("drawer-form");
  setupPicker(drawerForm);
  drawerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = formValues(drawerForm);
    act("saveDrawer", { item: v }, v.id ? "Drawer find updated." : "Tucked into the drawer.", drawerForm.querySelector('button[type="submit"]'))
      .then(function () { resetForm(drawerForm, "Tuck a find in the drawer"); });
  });
  drawerForm.querySelector("[data-cancel]").addEventListener("click", function () { resetForm(drawerForm, "Tuck a find in the drawer"); });

  // Same rule as the website: today's dated find first, otherwise the undated ones take turns
  function todaysDrawerId(items) {
    var today = todayKey();
    for (var i = 0; i < items.length; i++) if (items[i].date === today) return items[i].id;
    var undated = items.filter(function (x) { return !x.date; });
    if (!undated.length) return null;
    var p = today.split("-");
    var dayNumber = Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
    return undated[dayNumber % undated.length].id;
  }

  function renderDrawer() {
    var list = $("drawer-list");
    list.textContent = "";
    var today = todayKey();
    var todayId = todaysDrawerId(state.drawer);
    var items = state.drawer.slice().sort(function (a, b) {
      if (!a.date !== !b.date) return a.date ? -1 : 1;
      return String(a.date).localeCompare(String(b.date));
    });
    if (!items.length) list.appendChild(el("li", "office-empty", "The drawer is empty. The website will say a new find is on its way."));
    items.forEach(function (d) {
      var past = d.date && d.date < today;
      var li = el("li", "office-item" + (past ? " is-muted" : ""));
      li.appendChild(thumb(d));
      var body = el("div", "office-item__body");
      body.appendChild(el("p", "office-item__meta", [d.era, d.price].filter(Boolean).join(" · ")));
      body.appendChild(el("h3", "office-item__title", d.title));
      var when = d.id === todayId ? "Showing today" : d.date ? (past ? "Showed " : "Scheduled for ") + niceDay(d.date) : "In the rotation";
      body.appendChild(el("span", "chip " + (d.id === todayId ? "chip--on" : "chip--off"), when));
      li.appendChild(body);
      var actions = el("div", "office-item__actions");
      actions.appendChild(button("Edit", "", function () { editInForm(drawerForm, d, "Edit drawer find"); }));
      actions.appendChild(button("Delete", "is-danger", function (e) {
        if (confirm("Remove “" + d.title + "” from the drawer?")) act("deleteDrawer", { id: d.id }, "Removed from the drawer.", e.target);
      }));
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  /* ==========================================================================
     St. Jude total
     ========================================================================== */
  var impactForm = $("impact-form");
  impactForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = formValues(impactForm);
    act("saveImpact", { total: v.total, nextMilestone: v.nextMilestone }, "St. Jude total updated. Thank you!", impactForm.querySelector('button[type="submit"]'));
  });
  function renderImpact() {
    var i = state.impact || { total: 0, nextMilestone: 1000 };
    impactForm.elements.total.value = i.total || 0;
    impactForm.elements.nextMilestone.value = i.nextMilestone || "";
    $("impact-hint").textContent = "The website shows " + money.format(i.total || 0) +
      (i.asOf ? ", last updated " + niceDay(i.asOf) : "") + ". Saving also sets today as the “updated” date.";
  }

  /* ==========================================================================
     Shop Map
     ========================================================================== */
  var mapForm = $("map-form");
  function renderMap() {
    var rows = $("map-rows");
    rows.textContent = "";
    var featured = "";
    (state.map || []).forEach(function (z, i) {
      if (z.featured) featured = z.zone;
      var row = el("fieldset", "map-row");
      row.appendChild(el("legend", "", (i + 1) + ". " + (ZONE_NAMES[z.zone] || z.zone)));
      var t = el("label", "field"); t.appendChild(el("span", "", "Title"));
      var ti = el("input"); ti.name = "title-" + z.zone; ti.value = z.title || ""; ti.maxLength = 60; t.appendChild(ti);
      var b = el("label", "field"); b.appendChild(el("span", "", "What’s there"));
      var bi = el("textarea"); bi.name = "blurb-" + z.zone; bi.rows = 2; bi.maxLength = 300; bi.value = z.blurb || ""; b.appendChild(bi);
      var r = el("label", "check");
      var ri = el("input"); ri.type = "radio"; ri.name = "featured"; ri.value = z.zone;
      r.appendChild(ri); r.appendChild(document.createTextNode(" This week’s corner"));
      row.appendChild(t); row.appendChild(b); row.appendChild(r);
      rows.appendChild(row);
    });
    Array.prototype.forEach.call(mapForm.querySelectorAll('input[name="featured"]'), function (r) { r.checked = r.value === featured; });
  }
  mapForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var featured = (mapForm.querySelector('input[name="featured"]:checked') || {}).value || "";
    var zones = (state.map || []).map(function (z) {
      return {
        zone: z.zone,
        title: mapForm.elements["title-" + z.zone].value.trim(),
        blurb: mapForm.elements["blurb-" + z.zone].value.trim(),
        featured: z.zone === featured
      };
    });
    act("saveMap", { zones: zones }, "Map saved.", mapForm.querySelector('button[type="submit"]'));
  });

  /* ==========================================================================
     Lost Board
     ========================================================================== */
  var lostFilter = "pending";
  Array.prototype.forEach.call(document.querySelectorAll(".office-filters button"), function (b) {
    b.addEventListener("click", function () {
      lostFilter = b.getAttribute("data-status");
      Array.prototype.forEach.call(document.querySelectorAll(".office-filters button"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      renderLost();
    });
  });

  function renderLost() {
    var list = $("lost-list");
    list.textContent = "";
    var pending = state.lost.filter(function (c) { return c.status === "pending"; }).length;
    var badge = $("lost-pending-count");
    badge.textContent = pending;
    badge.hidden = !pending;

    var cards = state.lost.filter(function (c) { return c.status === lostFilter; })
      .sort(function (a, b) { return String(b.posted).localeCompare(String(a.posted)); });
    if (!cards.length) {
      list.appendChild(el("li", "office-empty", {
        pending: "No cards waiting. You’re all caught up!",
        looking: "No cards on the board right now.",
        found: "Nothing marked found yet.",
        hidden: "No hidden cards."
      }[lostFilter]));
      return;
    }
    cards.forEach(function (c) {
      var li = el("li", "office-card");
      li.appendChild(el("p", "office-item__meta", (c.name || "A shopper") + " · " + niceDay(c.posted)));
      li.appendChild(el("h3", "office-item__title", c.item));
      if (c.details) li.appendChild(el("p", "office-item__desc", c.details));
      if (c.email) {
        var a = el("a", "office-card__email", c.email);
        a.href = "mailto:" + c.email;
        li.appendChild(a);
      }
      if (c.status === "found") {
        li.appendChild(el("p", "office-card__note", (c.foundNote ? "“" + c.foundNote + "” — " : "") + (c.notified ? "shopper emailed" : "not emailed yet")));
      }
      var actions = el("div", "office-item__actions");
      function set(status, msg) { return function (e) { act("setLostStatus", { id: c.id, status: status }, msg, e.target); }; }
      if (c.status === "pending" || c.status === "hidden") actions.appendChild(button("Approve", "is-primary", set("looking", "Pinned to the board.")));
      if (c.status === "looking") actions.appendChild(button("Mark found…", "is-primary", function () { showFoundForm(li, c); }));
      if (c.status === "found") actions.appendChild(button("Back to looking", "", set("looking", "Moved back to “still looking.”")));
      if (c.status !== "hidden") actions.appendChild(button("Hide", "", set("hidden", "Hidden from the board.")));
      if (c.status === "pending" || c.status === "hidden") {
        actions.appendChild(button("Delete", "is-danger", function (e) {
          if (confirm("Delete this card for good?")) act("deleteLost", { id: c.id }, "Card deleted.", e.target);
        }));
      }
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function showFoundForm(li, c) {
    if (li.querySelector(".found-form")) return;
    var f = el("form", "found-form");
    var label = el("label", "field");
    label.appendChild(el("span", "", "Note for the board (optional)"));
    var input = el("input"); input.maxLength = 120; input.placeholder = "Waiting for you at the counter!";
    label.appendChild(input);
    f.appendChild(label);
    f.appendChild(el("p", "office-hint", practice ? "In practice mode no email is sent." : "We’ll email " + (c.name || "the shopper").split(" ")[0] + " to let them know."));
    var ok = el("button", "btn btn--ink", "Stamp it found");
    ok.type = "submit";
    f.appendChild(ok);
    f.appendChild(button("Cancel", "", function () { f.remove(); }));
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      act("setLostStatus", { id: c.id, status: "found", foundNote: input.value.trim() }, "Stamped found!", ok);
    });
    li.appendChild(f);
    input.focus();
  }

  /* ---------- Render everything ---------- */
  function renderAll() {
    if (!state) return;
    state.finds = state.finds || [];
    state.drawer = state.drawer || [];
    state.lost = state.lost || [];
    renderFinds();
    renderDrawer();
    renderImpact();
    renderMap();
    renderLost();
  }

  start();
})();
