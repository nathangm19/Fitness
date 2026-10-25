(function () {
  "use strict";
  var C = window.Core, MEALS = C.MEALS;
  var KEY = "tracker-v1", FUEL_KEY = "fuel-log-v1", PLAN_KEY = "tracker-plan", GKEY = "tracker-gemini", UKEY = "tracker-usda";
  var OFF = "https://world.openfoodfacts.org", USDA = "https://api.nal.usda.gov/fdc/v1";
  var OFF_FIELDS = "code,product_name,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit";
  var PLAN_URL = "../fuel-log/plan.json";
  var CIRC = 2 * Math.PI * 64;

  var S = load(), MENU = readJSON(PLAN_KEY);
  var day = today(), view = "today";
  var add = { meal: "b", list: "plan", panel: null };
  var fd = { food: null, entry: null, meal: "b", from: "add" };

  /* ---------- storage ---------- */
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function load() {
    var s = C.norm(readJSON(KEY));
    if (s) return s;
    // first open: carry Fuel Log's diary across (same origin, same shape); Fuel Log's copy is left alone
    var f = C.norm(readJSON(FUEL_KEY));
    if (f && Object.keys(f.days).length) {
      f.settings = Object.assign(C.blank().settings, f.settings);
      try { localStorage.setItem(KEY, JSON.stringify(f)); } catch (e) {}
      setTimeout(function () { toast("Brought over your Fuel Log diary."); }, 600);
      return f;
    }
    return C.blank();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
    catch (e) { toast("Couldn't save on this phone. Storage is full or blocked.", true); return false; }
  }
  function getKey(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }

  /* ---------- helpers ---------- */
  function today() { return C.iso(new Date()); }
  function el(id) { return document.getElementById(id); }
  function mk(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function n0(x) { return Math.round(x || 0).toLocaleString("en-US"); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function longDate(d) { var x = C.parseISO(d); return DOW[x.getDay()] + ", " + MON[x.getMonth()] + " " + x.getDate(); }
  function shortDate(d) { var x = C.parseISO(d); return MON[x.getMonth()] + " " + x.getDate(); }
  function mealName(m) { return MEALS.filter(function (x) { return x[0] === m; })[0][1]; }
  function buzz() { if (navigator.vibrate) navigator.vibrate(12); }
  var toastTimer;
  function toast(msg, bad) {
    var t = el("toast"); t.textContent = msg; t.className = "toast on" + (bad ? " bad" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = "toast" + (bad ? " bad" : ""); }, bad ? 4500 : 2600);
  }
  var ICON = {
    plus: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M7 2v10M2 7h10"/></svg>',
    plan: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="3.5" width="13" height="12" rx="2.5"/><path d="M2.5 7.5h13M6 2v3M12 2v3"/></svg>'
  };
  function row(title, sub, val, onClick) {
    var r = mk(onClick ? "button" : "div", "row"), main = mk("span", "row-main");
    main.appendChild(mk("span", "row-title", title));
    if (sub) main.appendChild(mk("span", "row-sub", sub));
    r.appendChild(main);
    if (val != null) r.appendChild(mk("span", "row-val", val));
    if (onClick) r.addEventListener("click", onClick);
    return r;
  }

  /* ---------- Today ---------- */
  function render() {
    if (view === "today") renderToday();
    if (view === "plan") renderPlanView();
    if (view === "progress") renderProgress();
  }
  function renderToday() {
    var t = C.totals(S, day), set = S.settings, rem = C.remaining(set, t), now = today();
    el("day-title").textContent = day === now ? "Today" : day === C.addDays(now, -1) ? "Yesterday" : shortDate(day);
    el("day-eyebrow").textContent = longDate(day);
    el("next").disabled = day >= now;

    var frac = rem.budget > 0 ? Math.min(1, t.k / rem.budget) : 0;
    el("ring-arc").setAttribute("stroke-dasharray", (frac * CIRC).toFixed(1) + " " + CIRC.toFixed(1));
    el("ring-num").textContent = n0(rem.value);
    el("ring-lab").textContent = rem.over ? "over" : "left";
    el("ring").classList.toggle("over", rem.over);
    el("ring-svg").setAttribute("aria-label", n0(t.k) + " of " + n0(rem.budget) + " calories eaten");
    el("st-goal").textContent = n0(set.kcal);
    el("st-food").textContent = n0(t.k);
    el("st-ex").textContent = n0(t.ex);
    [["p", set.protein], ["c", set.carbs], ["f", set.fat]].forEach(function (m) {
      var v = t[m[0]], g = m[1];
      el("mb-" + m[0]).style.width = g > 0 ? Math.min(100, v / g * 100) + "%" : "0";
      el("mv-" + m[0]).textContent = n0(v) + (g > 0 ? " / " + n0(g) : "") + " g";
    });

    var host = el("meals"); host.textContent = "";
    var rec = S.days[day], yest = S.days[C.addDays(day, -1)], groups = C.planGroups(MENU, day);
    MEALS.forEach(function (m) {
      var id = m[0], list = (rec && rec.meals[id]) || [], sec = mk("section", "section");
      var head = mk("div", "section-head"); head.appendChild(mk("h2", null, m[1]));
      head.appendChild(mk("span", "sub num", list.length ? n0(t.meal[id]) : "Nothing yet"));
      sec.appendChild(head);
      var box = mk("div", "list");
      list.forEach(function (e) {
        box.appendChild(row(e.name, [e.amount, n0(e.p) + " g protein"].filter(Boolean).join(" · "), n0(e.kcal), function () { openFood(null, e, id); }));
      });
      if (!list.length) {
        var y = yest && yest.meals[id] && yest.meals[id].length ? yest.meals[id] : null;
        if (y) {
          var cr = row("Same as yesterday", y.map(function (e) { return e.name; }).join(", "), null, null);
          var cb = mk("button", "pill soft", "Copy"); cb.setAttribute("aria-label", "Copy yesterday's " + m[1].toLowerCase());
          cb.addEventListener("click", function () { copyMeal(id); }); cr.appendChild(cb); box.appendChild(cr);
        }
        var pf = groups && groups.today.filter(function (f) { return f.slot === id; })[0];
        if (pf) {
          var pr = mk("div", "row"), tile = mk("span", "icon-tile"); tile.innerHTML = ICON.plan; pr.appendChild(tile);
          var main = mk("span", "row-main"); main.appendChild(mk("span", "row-title", pf.name));
          main.appendChild(mk("span", "row-sub", "From this week's plan · " + n0(pf.perServing.kcal) + " · " + n0(pf.perServing.p) + " g")); pr.appendChild(main);
          var lb = mk("button", "pill", "Log"); lb.setAttribute("aria-label", "Log " + pf.name);
          lb.addEventListener("click", function () { logFood(pf, 1, "serving", id); }); pr.appendChild(lb); box.appendChild(pr);
        }
      }
      var ar = mk("button", "row"); ar.appendChild(mk("span", "row-add", "Add food")); ar.setAttribute("data-add", id);
      ar.addEventListener("click", function () { openAdd(id); }); box.appendChild(ar);
      sec.appendChild(box); host.appendChild(sec);
    });

    var ex = (rec && rec.exercise) || [], exl = el("ex-list"); exl.textContent = "";
    exl.hidden = !ex.length;
    ex.forEach(function (x, i) {
      exl.appendChild(row(x.name, x.min ? n0(x.min) + " min" : "", n0(x.kcal), function () {
        if (confirm("Remove " + x.name + "?")) { rec.exercise.splice(i, 1); save(); render(); }
      }));
    });
    el("ex-sub").textContent = ex.length ? n0(t.ex) : "";
    el("ex-note").textContent = set.exBack ? "Exercise calories are added back to your ceiling." : "Logged, not added back to your ceiling. Change that under Me.";
    var w = rec && rec.weight;
    el("w-sub").textContent = w ? w.toFixed(1) + " lb" : "";
    el("w-in").placeholder = w ? w.toFixed(1) : "196.8";
  }
  function copyMeal(id) {
    var src = S.days[C.addDays(day, -1)].meals[id], dst = C.dayRec(S, day).meals[id];
    src.forEach(function (e) { dst.push(Object.assign({}, e, { id: uid() })); });
    save(); buzz(); render(); toast("Copied yesterday's " + mealName(id).toLowerCase() + ".");
  }
  function logFood(food, qty, unit, meal) {
    var e = C.makeEntry(food, qty, unit, uid());
    C.dayRec(S, day).meals[meal].push(e);
    remember(food, qty, unit);
    save(); buzz(); render(); toast("Added " + food.name + ".");
  }
  function remember(food, qty, unit) {
    if (food.source === "quick") return;
    food.lastQty = qty; food.lastUnit = unit; S.foods[food.id] = food;
    S.recent = [food.id].concat(S.recent.filter(function (id) { return id !== food.id; })).slice(0, 40);
  }

  el("prev").addEventListener("click", function () { day = C.addDays(day, -1); render(); });
  el("next").addEventListener("click", function () { if (day < today()) { day = C.addDays(day, 1); render(); } });
  el("add-top").addEventListener("click", function () { openAdd(guessMeal()); });
  function guessMeal() { var h = new Date().getHours(); return h < 10 ? "b" : h < 14 ? "l" : h < 20 ? "d" : "s"; }
  el("ex-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var k = parseFloat(el("ex-kcal").value) || 0, min = parseFloat(el("ex-min").value) || 0, name = el("ex-name").value.trim() || "Exercise";
    if (!k && !min) return;
    C.dayRec(S, day).exercise.push({ name: name, min: min, kcal: Math.round(k) });
    save(); ["ex-name", "ex-min", "ex-kcal"].forEach(function (i) { el(i).value = ""; }); buzz(); render();
  });
  el("w-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var w = parseFloat(el("w-in").value);
    if (!(w >= 80 && w <= 500)) { toast("Weight should be between 80 and 500 lb.", true); return; }
    C.dayRec(S, day).weight = Math.round(w * 10) / 10; save(); el("w-in").value = ""; buzz(); render(); toast("Weight saved.");
  });

  /* ---------- views ---------- */
  document.querySelectorAll(".tabbar button").forEach(function (b) {
    b.addEventListener("click", function () { showView(b.getAttribute("data-v")); });
  });
  function showView(v) {
    view = v;
    ["today", "plan", "progress", "me"].forEach(function (x) { el("v-" + x).hidden = x !== v; });
    document.querySelectorAll(".tabbar button").forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-v") === v)); });
    if (v === "me") fillMe();
    window.scrollTo(0, 0); render();
  }

  /* ---------- Plan ---------- */
  var SLOT = { b: "Breakfast", l: "Lunch", d: "Dinner", s: "Snack" };
  function planSub(f) {
    var x = f.day ? DOW[C.parseISO(f.day).getDay()].slice(0, 3) + (f.slot ? " " + SLOT[f.slot].toLowerCase() : "") : "Any day";
    return [x, n0(f.perServing.kcal) + " kcal", n0(f.perServing.p) + " g protein"].join(" · ");
  }
  function planSections(host, onPick) {
    var g = C.planGroups(MENU, day);
    if (!g) { host.appendChild(mk("p", "note", "No meal plan for this week yet. Once a week's cooking is approved, the meals show up here for one-tap logging.")); return false; }
    [["Today", g.today], ["Leftovers", g.earlier], ["Later this week", g.later], ["Any day", g.any]].forEach(function (s) {
      if (!s[1].length) return;
      var sec = mk("div", "section"); sec.appendChild(mk("p", "eyebrow", s[0])).style.padding = "0 4px";
      var box = mk("div", "list");
      s[1].forEach(function (f) {
        var r = row(f.name, f.serving.label + " · " + planSub(f), null, function () { onPick(f); });
        var p = mk("span", "plus"); p.innerHTML = ICON.plus; r.appendChild(p); box.appendChild(r);
      });
      sec.appendChild(box); host.appendChild(sec);
    });
    return true;
  }
  function renderPlanView() {
    var host = el("plan-body"); host.textContent = ""; host.className = "section";
    el("plan-eyebrow").textContent = MENU && MENU.start ? shortDate(MENU.start) + " – " + shortDate(MENU.end) + " · your portions" : "This week's cooking";
    planSections(host, function (f) { openFood(f, null, f.slot || guessMeal(), "plan"); });
  }
  async function fetchMenu() {
    try {
      var r = await fetch(PLAN_URL, { cache: "no-cache" }); if (!r.ok) return;
      var j = await r.json(); if (!j || j.v !== 1 || !Array.isArray(j.meals) || !j.start || !j.end) return;
      MENU = j; try { localStorage.setItem(PLAN_KEY, JSON.stringify(j)); } catch (e) {}
      render(); if (!el("sheet-add").hidden && add.list === "plan") renderAddList();
    } catch (e) {}
  }

  /* ---------- Progress ---------- */
  var range = 30;
  document.querySelectorAll("#range button").forEach(function (b) {
    b.addEventListener("click", function () {
      range = +b.getAttribute("data-r");
      document.querySelectorAll("#range button").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      renderProgress();
    });
  });
  function svg(tag, attrs) { var n = document.createElementNS("http://www.w3.org/2000/svg", tag); Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); return n; }
  function renderProgress() {
    var set = S.settings, now = today(), pts = C.trend(C.weighIns(S));
    var from = range ? C.addDays(now, -range + 1) : (pts.length ? pts[0].d : set.planStart);
    if (!range && set.planStart < from) from = set.planStart;
    var shown = pts.filter(function (p) { return p.d >= from; }), last = pts[pts.length - 1];
    el("w-trend").innerHTML = "";
    if (last) { el("w-trend").appendChild(document.createTextNode(last.t.toFixed(1) + " ")); el("w-trend").appendChild(mk("small", null, "lb")); }
    else el("w-trend").textContent = "–";
    el("w-goal").textContent = n0(set.weightGoal) + " lb";

    var ch = el("w-chart"); ch.textContent = "";
    var W = 320, H = 132, span = Math.max(1, (C.parseISO(now) - C.parseISO(from)) / 864e5);
    var vals = shown.map(function (p) { return p.w; }).concat([C.planWeight(set, set.planStart > from ? set.planStart : from), C.planWeight(set, now)]);
    var lo = Math.floor(Math.min.apply(null, vals) - 1), hi = Math.ceil(Math.max.apply(null, vals) + 1);
    var X = function (d) { return 6 + (C.parseISO(d) - C.parseISO(from)) / 864e5 / span * (W - 12); };
    var Y = function (v) { return 8 + (hi - v) / (hi - lo) * (H - 16); };
    [0, 0.5, 1].forEach(function (f) { var y = 8 + f * (H - 16); ch.appendChild(svg("line", { x1: 0, x2: W, y1: y, y2: y, stroke: "var(--track)" })); });
    var p0 = set.planStart > from ? set.planStart : from;   // the plan line starts the day the plan did
    if (p0 <= now) ch.appendChild(svg("line", { x1: X(p0), y1: Y(C.planWeight(set, p0)), x2: X(now), y2: Y(C.planWeight(set, now)), stroke: "var(--ink-2)", "stroke-opacity": 0.6, "stroke-width": 1.5, "stroke-dasharray": "4 4" }));
    shown.forEach(function (p) { ch.appendChild(svg("circle", { cx: X(p.d), cy: Y(p.w), r: 3, fill: "var(--cal-soft)" })); });
    if (shown.length > 1) {
      ch.appendChild(svg("path", { d: shown.map(function (p, i) { return (i ? "L" : "M") + X(p.d).toFixed(1) + " " + Y(p.t).toFixed(1); }).join(" "),
                                   fill: "none", stroke: "var(--cal)", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    }
    if (!shown.length) {
      var tx = svg("text", { x: W / 2, y: H / 2, "text-anchor": "middle", "font-size": 13, fill: "var(--ink-2)" });
      tx.textContent = "Log a morning weight on Today to start the line"; ch.appendChild(tx);
    }
    var ax = el("w-axis"); ax.textContent = "";
    [from, C.addDays(from, Math.round(span / 2)), now].forEach(function (d) { ax.appendChild(mk("span", null, shortDate(d))); });

    var wk = C.week(S, now), bars = el("wk-bars"), days = el("wk-days"); bars.textContent = ""; days.textContent = "";
    var top = Math.max(set.kcal * 1.1, Math.max.apply(null, wk.days.map(function (x) { return x.k; })));
    var line = mk("div", "ceiling"); line.style.bottom = (set.kcal / top * 112) + "px"; bars.appendChild(line);
    wk.days.forEach(function (x) {
      var b = mk("i", x.today ? "part" : x.k > set.kcal ? "over" : null); b.style.height = (x.k / top * 112) + "px";
      b.title = shortDate(x.d) + ": " + n0(x.k) + " kcal"; bars.appendChild(b);
      days.appendChild(mk("span", null, DOW[C.parseISO(x.d).getDay()].charAt(0)));
    });
    el("wk-sub").textContent = wk.logged ? "avg " + n0(wk.avg) + " · " + wk.under + " of " + wk.logged + " under" : "No finished days logged yet";

    var bd = C.burnDays(S);
    el("burn-bar").style.width = Math.min(100, bd / C.TDEE_DAYS * 100) + "%";
    el("burn-text").textContent = bd >= C.TDEE_DAYS
      ? "Enough days to estimate your burn. The estimate itself arrives in the next release."
      : "Learning it from your weight and what you log. " + bd + " of " + C.TDEE_DAYS + " days. Your ceiling stays at " + n0(set.kcal) + " until then.";
  }

  /* ---------- Me ---------- */
  function fillMe() {
    var s = S.settings;
    el("g-kcal").value = s.kcal; el("g-p").value = s.protein; el("g-c").value = s.carbs || ""; el("g-f").value = s.fat || "";
    el("g-ex").checked = !!s.exBack; el("g-ws").value = s.weightStart; el("g-wg").value = s.weightGoal; el("g-rate").value = s.rate; el("g-start").value = s.planStart;
    el("k-gem").value = ""; el("k-usda").value = "";
    var g = getKey(GKEY), u = getKey(UKEY);
    el("k-note").textContent = (g ? "Gemini key saved (ends " + g.slice(-4) + "). " : "No Gemini key yet. ") + (u ? "USDA key saved." : "USDA uses the shared demo key.") + " Keys stay on this phone and are left out of backups.";
  }
  el("goals").addEventListener("submit", function (e) {
    e.preventDefault();
    var k = parseFloat(el("g-kcal").value);
    if (!(k >= 800 && k <= 6000)) { toast("Ceiling should be between 800 and 6,000.", true); return; }
    var num = function (id, d) { var v = parseFloat(el(id).value); return isFinite(v) ? v : d; };
    S.settings = Object.assign(S.settings, { kcal: Math.round(k), protein: Math.round(num("g-p", 0)), carbs: Math.round(num("g-c", 0)), fat: Math.round(num("g-f", 0)),
      exBack: el("g-ex").checked, weightStart: num("g-ws", S.settings.weightStart), weightGoal: num("g-wg", S.settings.weightGoal),
      rate: num("g-rate", S.settings.rate), planStart: el("g-start").value || S.settings.planStart });
    save(); buzz(); toast("Goals saved.");
  });
  el("k-save").addEventListener("click", function () {
    var g = el("k-gem").value.trim(), u = el("k-usda").value.trim();
    try { if (g) localStorage.setItem(GKEY, g); if (u) localStorage.setItem(UKEY, u); } catch (e) { toast("Couldn't save the key.", true); return; }
    fillMe(); toast(g || u ? "Keys saved." : "Nothing to save.");
  });
  function download(name, text, type) {
    var a = mk("a"); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  el("d-csv").addEventListener("click", function () { download("tracker-diary-" + today() + ".csv", C.csv(S), "text/csv"); toast("Diary exported."); });
  el("d-json").addEventListener("click", function () { download("tracker-backup-" + today() + ".json", JSON.stringify(S, null, 1), "application/json"); toast("Backup saved."); });
  el("d-imp").addEventListener("change", async function () {
    var f = el("d-imp").files[0]; el("d-imp").value = ""; if (!f) return;
    try { var s = C.norm(JSON.parse(await f.text())); if (!s) throw new Error("x"); S = s; save(); fillMe(); render(); toast("Backup restored."); }
    catch (e) { toast("That isn't a Tracker or Fuel Log backup. Nothing changed.", true); }
  });

  /* ---------- sheets ---------- */
  var openSheets = [];
  function openSheet(id) {
    var s = el(id), scrim = el("scrim");
    scrim.hidden = false; s.hidden = false; document.body.style.overflow = "hidden";
    requestAnimationFrame(function () { scrim.classList.add("on"); s.classList.add("on"); });
    if (openSheets.indexOf(id) < 0) openSheets.push(id);
  }
  function closeSheet(id) {
    var s = el(id); s.classList.remove("on");
    openSheets = openSheets.filter(function (x) { return x !== id; });
    if (!openSheets.length) { el("scrim").classList.remove("on"); document.body.style.overflow = ""; }
    setTimeout(function () { if (!s.classList.contains("on")) s.hidden = true; if (!openSheets.length) el("scrim").hidden = true; }, 380);
  }
  el("scrim").addEventListener("click", function () { openSheets.slice().reverse().forEach(closeSheet); stopScan(); });

  /* ---------- Add food sheet ---------- */
  function openAdd(meal) {
    add.meal = meal; el("add-title").textContent = "Add to " + mealName(meal);
    el("q").value = ""; showPanel(null); setList(add.list); openSheet("sheet-add");
  }
  el("add-cancel").addEventListener("click", function () { stopScan(); closeSheet("sheet-add"); });
  function showPanel(p) {
    add.panel = add.panel === p ? null : p;
    ["scan", "photo", "quick", "custom"].forEach(function (x) { el("p-" + x).hidden = add.panel !== x; });
    document.querySelectorAll(".tile").forEach(function (t) { t.setAttribute("aria-pressed", String(t.getAttribute("data-panel") === add.panel)); });
    var searching = !!el("q").value.trim() && !add.panel;
    el("p-search").hidden = !searching; el("p-lists").hidden = !!add.panel || searching;
    if (add.panel !== "scan") stopScan();
  }
  document.querySelectorAll(".tile").forEach(function (t) { t.addEventListener("click", function () { showPanel(t.getAttribute("data-panel")); }); });
  document.querySelectorAll("#add-seg button").forEach(function (b) { b.addEventListener("click", function () { setList(b.getAttribute("data-l")); }); });
  function setList(l) {
    add.list = l;
    document.querySelectorAll("#add-seg button").forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-l") === l)); });
    renderAddList();
  }
  function foodSub(f) {
    if (f.source === "plan") return f.serving.label + " · " + n0(f.perServing.kcal) + " kcal · " + n0(f.perServing.p) + " g protein";
    if (f.per100 && f.serving && f.serving.grams) return [f.brand, n0(C.nutrition(f, 1, "serving").k) + " kcal · " + f.serving.label].filter(Boolean).join(" · ");
    if (f.per100) return [f.brand, n0(f.per100.kcal) + " kcal · 100 g"].filter(Boolean).join(" · ");
    if (f.perServing) return [f.brand, n0(f.perServing.kcal) + " kcal · " + ((f.serving && f.serving.label) || "serving")].filter(Boolean).join(" · ");
    return f.brand || "";
  }
  function foodRow(f, tag) {
    var r = row(f.name, foodSub(f), null, function () { openFood(f, null, add.meal, "add"); });
    if (tag) r.querySelector(".row-title").appendChild(mk("span", "tag", tag));
    var p = mk("span", "plus"); p.innerHTML = ICON.plus; r.appendChild(p);
    return r;
  }
  function renderAddList() {
    var host = el("add-list"); host.textContent = "";
    if (add.list === "plan") { planSections(host, function (f) { openFood(f, null, add.meal, "add"); }); return; }
    var box = mk("div", "list");
    if (add.list === "recent") {
      var items = C.recentList(S, day);
      if (!items.length) { host.appendChild(mk("p", "note", "Foods you log show up here for one-tap adding.")); return; }
      items.forEach(function (x) { box.appendChild(foodRow(x.food, x.frequent ? "Frequent" : null)); });
    } else {
      var mine = Object.keys(S.foods).map(function (k) { return S.foods[k]; }).filter(function (f) { return f.source === "custom"; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
      mine.forEach(function (f) { box.appendChild(foodRow(f)); });
      var nr = mk("button", "row"); nr.appendChild(mk("span", "row-add", "New food"));
      nr.addEventListener("click", function () { showPanel("custom"); el("cf-name").focus(); }); box.appendChild(nr);
      if (!mine.length) host.appendChild(mk("p", "note", "Save meal-prep bowls and home recipes here."));
    }
    host.appendChild(box);
  }

  // search: my foods and past foods first, then Open Food Facts and USDA side by side
  var searchSeq = 0, searchTimer;
  el("q").addEventListener("input", function () { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 450); showPanel(null); });
  el("q-form").addEventListener("submit", function (e) { e.preventDefault(); clearTimeout(searchTimer); el("q").blur(); runSearch(); });
  async function runSearch() {
    var q = el("q").value.trim(), host = el("p-search"), my = ++searchSeq;
    showPanel(null); host.textContent = "";
    if (!q) return;
    var words = q.toLowerCase().split(/\s+/);
    var local = Object.keys(S.foods).map(function (k) { return S.foods[k]; }).filter(function (f) {
      var s = (f.name + " " + (f.brand || "")).toLowerCase(); return words.every(function (w) { return s.indexOf(w) >= 0; });
    }).slice(0, 6);
    var mineBox = mk("div", "list"); local.forEach(function (f) { mineBox.appendChild(foodRow(f)); });
    if (local.length) { host.appendChild(mk("p", "eyebrow", "Yours")).style.padding = "0 4px"; host.appendChild(mineBox); }
    var status = mk("p", "note", "Searching…"); host.appendChild(status);
    var seen = {}; local.forEach(function (f) { seen[f.id] = 1; });
    var res = await Promise.all([searchUSDA(q).catch(function () { return null; }), searchOFF(q).catch(function () { return null; })]);
    if (my !== searchSeq) return;
    status.remove();
    var any = false;
    [["Generic foods · USDA", res[0]], ["Packaged foods · Open Food Facts", res[1]]].forEach(function (g) {
      var foods = (g[1] || []).filter(function (f) { return f && !seen[f.id] && (seen[f.id] = 1); });
      if (!foods.length) return;
      any = true;
      host.appendChild(mk("p", "eyebrow", g[0])).style.padding = "0 4px";
      var box = mk("div", "list"); foods.forEach(function (f) { box.appendChild(foodRow(f)); }); host.appendChild(box);
    });
    if (!any && !local.length) host.appendChild(mk("p", "note", res[0] == null && res[1] == null
      ? "The food databases didn't answer. Check your signal, or use Quick add."
      : "No matches. Try fewer words, or use Quick add."));
  }
  async function searchOFF(q) {
    var r = await fetch(OFF + "/cgi/search.pl?search_simple=1&action=process&json=1&page_size=20&search_terms=" + encodeURIComponent(q) + "&fields=" + OFF_FIELDS);
    if (!r.ok) throw new Error(r.status);
    var j = await r.json(); return (j.products || []).map(function (p) { return C.fromOFF(p, uid); });
  }
  async function searchUSDA(q) {
    var key = getKey(UKEY) || "DEMO_KEY";
    var r = await fetch(USDA + "/foods/search?api_key=" + encodeURIComponent(key) + "&pageSize=8&dataType=Foundation,SR%20Legacy&query=" + encodeURIComponent(q));
    if (!r.ok) throw new Error(r.status);
    var j = await r.json(); return (j.foods || []).map(C.fromUSDA);
  }

  // quick add
  el("p-quick").addEventListener("submit", function (e) {
    e.preventDefault();
    var k = parseFloat(el("qa-k").value);
    if (!(k >= 0)) { toast("Quick add needs a calorie number.", true); return; }
    var num = function (id) { return Math.round((parseFloat(el(id).value) || 0) * 10) / 10; };
    C.dayRec(S, day).meals[add.meal].push({ id: uid(), foodId: null, name: el("qa-name").value.trim() || "Quick add", brand: "", qty: 1, unit: "serving",
      amount: "quick add", kcal: Math.round(k), p: num("qa-p"), c: num("qa-c"), f: num("qa-f") });
    save(); ["qa-name", "qa-k", "qa-p", "qa-c", "qa-f"].forEach(function (i) { el(i).value = ""; });
    buzz(); closeSheet("sheet-add"); render(); toast("Added to " + mealName(add.meal).toLowerCase() + ".");
  });
  // custom food
  el("p-custom").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = el("cf-name").value.trim(), k = parseFloat(el("cf-k").value);
    if (!name || !(k >= 0)) { toast("A new food needs a name and calories.", true); return; }
    var num = function (id) { return parseFloat(el(id).value) || 0; };
    var f = { id: "my-" + uid(), source: "custom", name: name, brand: "", barcode: el("cf-bc").value.replace(/\D/g, ""),
              serving: { label: el("cf-serv").value.trim() || "serving" }, perServing: { kcal: k, p: num("cf-p"), c: num("cf-c"), f: num("cf-f") } };
    S.foods[f.id] = f; save();
    ["cf-name", "cf-serv", "cf-k", "cf-p", "cf-c", "cf-f", "cf-bc"].forEach(function (i) { el(i).value = ""; });
    toast("Saved " + name + "."); showPanel(null); setList("mine"); openFood(f, null, add.meal, "add");
  });

  /* ---------- barcode ---------- */
  var scan = { stream: null, timer: null, det: null };
  function detector() {
    if (!("BarcodeDetector" in window)) return null;
    try { return scan.det || (scan.det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] })); } catch (e) { return null; }
  }
  async function lookupBarcode(code) {
    code = String(code || "").replace(/\D/g, "");
    if (code.length < 6) { toast("That barcode is too short. Check the digits.", true); return; }
    var strip = function (c) { return c.replace(/^0+/, ""); };
    var have = Object.keys(S.foods).map(function (k) { return S.foods[k]; }).filter(function (f) { return f.barcode && strip(f.barcode) === strip(code); })[0];
    if (have) { openFood(have, null, add.meal, "add"); return; }
    toast("Looking up " + code + "…");
    try {
      var r = await fetch(OFF + "/api/v2/product/" + code + ".json?fields=" + OFF_FIELDS), j = await r.json();
      var food = j && j.status === 1 && j.product ? C.fromOFF(Object.assign({ code: code }, j.product), uid) : null;
      if (food) { openFood(food, null, add.meal, "add"); return; }
      showPanel("custom"); el("cf-bc").value = code; el("cf-name").focus();
      toast("Barcode " + code + " isn't listed yet. Save it here and it scans next time.", true);
    } catch (e) { toast("Couldn't reach Open Food Facts. Check your signal.", true); }
  }
  el("bc-form").addEventListener("submit", function (e) { e.preventDefault(); lookupBarcode(el("bc").value); });
  el("scan-start").addEventListener("click", async function () {
    var det = detector();
    if (!det) { toast("This browser can't read barcodes live. Type the number instead.", true); return; }
    try { scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); }
    catch (e) { toast("Camera blocked. Allow it for this app, or type the barcode.", true); return; }
    var v = el("scan-video"); v.srcObject = scan.stream; v.hidden = false; el("scan-start").hidden = true; await v.play().catch(function () {});
    scan.timer = setInterval(async function () {
      if (!scan.stream || v.readyState < 2) return;
      try { var codes = await det.detect(v); if (codes.length) { var c = codes[0].rawValue; stopScan(); buzz(); lookupBarcode(c); } } catch (e) {}
    }, 250);
  });
  function stopScan() {
    if (scan.timer) clearInterval(scan.timer); scan.timer = null;
    if (scan.stream) scan.stream.getTracks().forEach(function (t) { t.stop(); }); scan.stream = null;
    el("scan-video").hidden = true; el("scan-start").hidden = false;
  }

  /* ---------- photo estimate (Gemini) ---------- */
  var MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-lite-latest"];
  var photo = { b64: null, items: [], busy: false };
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error("img")); };
      img.src = url;
    });
  }
  async function takePhoto(input) {
    var file = input.files[0]; input.value = ""; if (!file) return;
    photo.items = []; el("ph-results").textContent = ""; el("ph-add").hidden = true;
    try { var url = await shrink(file); photo.b64 = url.split(",")[1]; el("ph-img").src = url; el("ph-img").hidden = false; }
    catch (e) { toast("Couldn't read that photo.", true); return; }
    el("ph-go").disabled = !getKey(GKEY);
    if (!getKey(GKEY)) toast("Add a Gemini key under Me first.", true);
  }
  el("ph-cam").addEventListener("change", function () { takePhoto(el("ph-cam")); });
  el("ph-lib").addEventListener("change", function () { takePhoto(el("ph-lib")); });
  function estimatePrompt() {
    var g = C.planGroups(MENU, day), lines = (g ? MENU.meals : []).map(function (m) {
      return "- id " + m.id + ": " + m.name + (m.components ? " (" + m.components + ")" : "") + ". One serving = " + (m.serving || "1 serving") + ": " +
        n0(m.kcal) + " kcal, " + n0(m.p) + " g protein, " + n0(m.c) + " g carbs, " + n0(m.f) + " g fat.";
    });
    var note = el("ph-note").value.trim();
    return "Estimate what one adult ate from this photo, for a calorie log. The meal is " + mealName(add.meal).toLowerCase() + ".\n" +
      (lines.length ? "Meals cooked at home this week, with the eater's own portion:\n" + lines.join("\n") +
        "\nIf an item is one of these, set plan_id to its id and servings to how many of that serving are on the plate.\n" : "") +
      "For anything else, plan_id is empty, servings is 0, and estimate from typical US nutrition data. Restaurant portions run large: estimate them high. " +
      "Count visible oil, butter, cheese, sauces and dressings. List each food separately, portions in US units. " +
      (note ? "The eater says: \"" + note.replace(/"/g, "'") + "\". Apply it.\n" : "") +
      "If the photo is not food, return no items and say so in note. note: one short sentence naming the biggest uncertainty.";
  }
  var SCHEMA = { type: "OBJECT", properties: {
    items: { type: "ARRAY", items: { type: "OBJECT", properties: {
      name: { type: "STRING" }, plan_id: { type: "STRING" }, portion: { type: "STRING" }, servings: { type: "NUMBER" },
      kcal: { type: "NUMBER" }, protein_g: { type: "NUMBER" }, carbs_g: { type: "NUMBER" }, fat_g: { type: "NUMBER" },
      confidence: { type: "STRING", enum: ["high", "medium", "low"] } },
      required: ["name", "plan_id", "portion", "servings", "kcal", "protein_g", "carbs_g", "fat_g", "confidence"] } },
    note: { type: "STRING" } }, required: ["items", "note"] };
  async function askGemini(body) {
    var key = getKey(GKEY), last = "busy";
    for (var i = 0; i < MODELS.length; i++) {
      var r;
      try { r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODELS[i] + ":generateContent",
        { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: body }); }
      catch (e) { throw new Error("offline"); }
      if (r.ok) {
        var j = await r.json(), parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        try { return JSON.parse(parts.map(function (p) { return p.thought ? "" : (p.text || ""); }).join("")); } catch (e) { last = "garbled"; continue; }
      }
      if (r.status === 401 || r.status === 403) throw new Error("key");
      if (r.status === 429 || r.status === 404 || r.status >= 500) { last = r.status === 429 ? "quota" : "busy"; continue; }
      throw new Error("http " + r.status);
    }
    throw new Error(last);
  }
  el("ph-go").addEventListener("click", async function () {
    if (!photo.b64 || photo.busy) return;
    photo.busy = true; el("ph-go").disabled = true; el("ph-go").textContent = "Looking at your plate…";
    var body = JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: photo.b64 } }, { text: estimatePrompt() }] }],
                                generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 } });
    try {
      var res = await askGemini(body), byId = {};
      ((MENU && MENU.meals) || []).forEach(function (m) { byId[m.id] = m; });
      photo.items = (res.items || []).map(function (x) {
        var m = byId[x.plan_id], s = m ? (+x.servings > 0 ? Math.round(+x.servings * 4) / 4 : 1) : 0;
        return { on: true, name: m ? m.name : String(x.name || "Food"), portion: String(x.portion || ""), conf: x.confidence || "medium", plan: m || null, servings: s,
                 kcal: m ? Math.round(m.kcal * s) : Math.max(0, Math.round(+x.kcal || 0)), p: m ? m.p * s : Math.max(0, +x.protein_g || 0),
                 c: m ? (m.c || 0) * s : Math.max(0, +x.carbs_g || 0), f: m ? (m.f || 0) * s : Math.max(0, +x.fat_g || 0) };
      });
      renderEstimate();
      if (!photo.items.length) toast(res.note || "No food found in that photo.", true); else if (res.note) toast(res.note);
    } catch (e) {
      toast({ key: "Google turned down the key. Check it under Me.", offline: "No connection. Try again with signal, or use Quick add.",
              quota: "Today's free Gemini allowance is used up. Use Quick add for now.", busy: "Gemini is busy. Try again in a minute.",
              garbled: "Gemini's answer came back unreadable. Try again." }[e.message] || "Estimate failed (" + e.message + ").", true);
    }
    photo.busy = false; el("ph-go").disabled = false; el("ph-go").textContent = "Estimate";
  });
  function renderEstimate() {
    var host = el("ph-results"); host.textContent = "";
    photo.items.forEach(function (it) {
      var box = mk("div", "est"), top = mk("label", "est-top"), cb = mk("input"); cb.type = "checkbox"; cb.checked = it.on;
      cb.addEventListener("change", function () { it.on = cb.checked; estTotal(); });
      top.appendChild(cb); top.appendChild(mk("span", null, it.name)); top.appendChild(mk("span", "conf", it.conf)); box.appendChild(top);
      box.appendChild(mk("span", "row-sub", [it.portion, it.plan ? "from your plan" : ""].filter(Boolean).join(" · ")));
      var f = mk("div", "fields");
      var kIn = numField("Kcal", it.kcal, function (v) { it.kcal = Math.round(v); estTotal(); });
      var pIn = numField("Protein", C.r1(it.p), function (v) { it.p = v; estTotal(); });
      f.appendChild(kIn); f.appendChild(pIn); box.appendChild(f); host.appendChild(box);
    });
    estTotal();
  }
  function numField(label, val, on) {
    var d = mk("div", "field"), l = mk("span", "lab", label), i = mk("input", "input num"); i.type = "number"; i.inputMode = "decimal"; i.value = val;
    i.setAttribute("aria-label", label); i.addEventListener("input", function () { on(parseFloat(i.value) || 0); }); d.appendChild(l); d.appendChild(i); return d;
  }
  function estTotal() {
    var on = photo.items.filter(function (x) { return x.on; }), k = 0;
    on.forEach(function (x) { k += x.kcal; });
    el("ph-add").hidden = !photo.items.length; el("ph-add").disabled = !on.length; el("ph-add").textContent = "Add " + n0(k) + " kcal";
  }
  el("ph-add").addEventListener("click", function () {
    var list = C.dayRec(S, day).meals[add.meal];
    photo.items.filter(function (x) { return x.on; }).forEach(function (x) {
      list.push({ id: uid(), foodId: x.plan ? "plan-" + x.plan.id : null, name: x.name, brand: "photo estimate", qty: x.servings || 1, unit: "serving",
                  amount: x.portion, kcal: Math.round(x.kcal), p: C.r1(x.p), c: C.r1(x.c), f: C.r1(x.f) });
    });
    save(); photo.items = []; photo.b64 = null; el("ph-img").hidden = true; el("ph-results").textContent = ""; el("ph-add").hidden = true; el("ph-note").value = "";
    buzz(); closeSheet("sheet-add"); render(); toast("Added to " + mealName(add.meal).toLowerCase() + ".");
  });

  /* ---------- Food detail sheet ---------- */
  function openFood(food, entry, meal, from) {
    fd.meal = meal; fd.entry = entry || null; fd.from = from || "today";
    if (entry) {
      food = S.foods[entry.foodId] || { id: entry.foodId || uid(), source: "quick", name: entry.name, brand: entry.brand,
        perServing: { kcal: entry.kcal / (entry.qty || 1), p: entry.p / (entry.qty || 1), c: (entry.c || 0) / (entry.qty || 1), f: (entry.f || 0) / (entry.qty || 1) },
        serving: { label: entry.amount && entry.qty === 1 ? entry.amount : "serving" } };
    }
    fd.food = food;
    el("fd-src").textContent = { off: "Open Food Facts" + (food.barcode ? " · " + food.barcode : ""), usda: "USDA FoodData Central", custom: "My food",
                                 plan: "This week's meal plan", quick: "Logged entry" }[food.source] || "";
    el("fd-name").textContent = food.name; el("fd-brand").textContent = food.source === "usda" ? "" : (food.brand || "");
    el("fd-meal").textContent = mealName(meal);
    var sel = el("fd-unit"); sel.textContent = "";
    C.unitsFor(food).forEach(function (u) { var o = mk("option", null, u.id === "serving" ? u.label + (u.grams ? " (" + C.r1(u.grams) + " g)" : "") : u.label); o.value = u.id; sel.appendChild(o); });
    var last = entry ? { qty: entry.qty, unit: entry.unit } : food.lastQty ? { qty: food.lastQty, unit: food.lastUnit } : null;
    var first = C.unitsFor(food)[0];
    if (last && last.unit && C.unitsFor(food).some(function (u) { return u.id === last.unit; })) sel.value = last.unit;
    el("fd-qty").value = last ? last.qty : first && first.id === "g" ? 100 : 1;
    el("fd-add").textContent = entry ? "Save" : "Add to " + mealName(meal);
    el("fd-del").hidden = !entry; el("fd-back").textContent = from === "add" ? "Back" : "Close";
    updateFood(); openSheet("sheet-food");
  }
  function updateFood() {
    var q = parseFloat(el("fd-qty").value) || 0, x = C.nutrition(fd.food, q, el("fd-unit").value);
    el("fd-k").textContent = n0(x.k); el("fd-p").textContent = n0(x.p); el("fd-c").textContent = n0(x.c); el("fd-f").textContent = n0(x.f);
    el("fd-add").disabled = !(q > 0);
    var t = C.totals(S, day), was = fd.entry ? fd.entry.kcal : 0, left = C.remaining(S.settings, { k: t.k - was + x.k, ex: t.ex });
    el("fd-after").textContent = "After this you'd have " + n0(left.value) + (left.over ? " over" : " left") + " for the day.";
  }
  el("fd-qty").addEventListener("input", updateFood);
  el("fd-unit").addEventListener("change", function () { var u = el("fd-unit").value; el("fd-qty").value = u === "g" ? 100 : u === "oz" ? 4 : 1; updateFood(); });
  el("fd-minus").addEventListener("click", function () { step(-1); });
  el("fd-plus").addEventListener("click", function () { step(1); });
  function step(dir) {
    var u = el("fd-unit").value, s = u === "g" ? 10 : u === "oz" ? 0.5 : 0.25, q = parseFloat(el("fd-qty").value) || 0;
    el("fd-qty").value = Math.max(s, C.r1(Math.round((q + dir * s) / s) * s)); updateFood();
  }
  el("fd-back").addEventListener("click", function () { closeSheet("sheet-food"); });
  el("fd-add").addEventListener("click", function () {
    var q = parseFloat(el("fd-qty").value) || 0, u = el("fd-unit").value; if (!(q > 0)) return;
    var list = C.dayRec(S, day).meals[fd.meal];
    if (fd.entry) {
      var e = C.makeEntry(fd.food, q, u, fd.entry.id);
      if (fd.food.source === "quick") e.foodId = fd.entry.foodId;
      var i = list.findIndex(function (x) { return x.id === fd.entry.id; }); if (i >= 0) list[i] = e;
      if (fd.food.source !== "quick") remember(fd.food, q, u);
      save(); buzz(); closeSheet("sheet-food"); render(); toast("Saved.");
      return;
    }
    list.push(C.makeEntry(fd.food, q, u, uid())); remember(fd.food, q, u); save(); buzz();
    closeSheet("sheet-food"); if (fd.from === "add") closeSheet("sheet-add"); stopScan();
    render(); toast("Added to " + mealName(fd.meal).toLowerCase() + ".");
  });
  el("fd-del").addEventListener("click", function () {
    var list = C.dayRec(S, day).meals[fd.meal], i = list.findIndex(function (x) { return x.id === fd.entry.id; });
    if (i >= 0) list.splice(i, 1); save(); buzz(); closeSheet("sheet-food"); render(); toast("Removed.");
  });

  /* ---------- start ---------- */
  // reopening the app on a new morning moves Today forward, unless you were looking at another day
  var opened = today();
  document.addEventListener("visibilitychange", function () {
    if (document.hidden || today() === opened) return;
    if (day === opened) day = today();
    opened = today(); render();
  });
  render(); fetchMenu();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
  window.__tracker = { state: function () { return S; } };
})();
