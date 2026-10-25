// All of Tracker's arithmetic, kept free of the page so verify.mjs can test it directly.
(function (root) {
  "use strict";
  var MEALS = [["b", "Breakfast"], ["l", "Lunch"], ["d", "Dinner"], ["s", "Snacks"]];
  var ALPHA = 0.1;              // trend weight, about a 10-day window (Tracker-Spec)
  var TDEE_DAYS = 21;           // days of food + weight before the burn estimate is trusted

  function blank() {
    return { v: 1, days: {}, foods: {}, recent: [],
             settings: { kcal: 2000, protein: 140, carbs: 180, fat: 65, exBack: false,
                         weightStart: 198, weightGoal: 180, rate: 1.5, planStart: "2026-10-18" } };
  }
  function norm(s) {
    if (!s || s.v !== 1 || typeof s.days !== "object" || !s.days) return null;
    s.settings = Object.assign(blank().settings, s.settings || {});
    s.foods = s.foods || {}; s.recent = s.recent || [];
    return s;
  }
  function dayRec(s, d) {
    var r = s.days[d];
    if (!r) r = s.days[d] = { meals: { b: [], l: [], d: [], s: [] }, exercise: [] };
    r.meals = r.meals || {};
    MEALS.forEach(function (m) { r.meals[m[0]] = r.meals[m[0]] || []; });
    r.exercise = r.exercise || [];
    return r;
  }

  /* dates, always local calendar days as YYYY-MM-DD */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }

  function totals(s, d) {
    var r = s.days[d], t = { k: 0, p: 0, c: 0, f: 0, ex: 0, n: 0, meal: { b: 0, l: 0, d: 0, s: 0 } };
    if (!r) return t;
    MEALS.forEach(function (m) {
      (r.meals[m[0]] || []).forEach(function (e) {
        t.k += e.kcal || 0; t.p += e.p || 0; t.c += e.c || 0; t.f += e.f || 0; t.n++;
        t.meal[m[0]] += e.kcal || 0;
      });
    });
    (r.exercise || []).forEach(function (x) { t.ex += x.kcal || 0; });
    return t;
  }
  // { value, over } — value is never negative; over says which side of the ceiling
  function remaining(settings, t) {
    var left = settings.kcal - t.k + (settings.exBack ? t.ex : 0);
    return { value: Math.round(Math.abs(left)), over: left < 0, budget: settings.kcal + (settings.exBack ? t.ex : 0) };
  }

  /* servings */
  function unitsFor(food) {
    var u = [];
    if (food.serving && food.serving.grams) u.push({ id: "serving", label: food.serving.label || "serving", grams: food.serving.grams });
    else if (food.perServing) u.push({ id: "serving", label: (food.serving && food.serving.label) || "serving", grams: 0 });
    if (food.per100) { u.push({ id: "g", label: "grams", grams: 1 }); u.push({ id: "oz", label: "ounces", grams: 28.3495 }); }
    return u;
  }
  function nutrition(food, qty, unitId) {
    var units = unitsFor(food), unit = units.filter(function (u) { return u.id === unitId; })[0] || units[0];
    if (!unit) return { k: 0, p: 0, c: 0, f: 0 };
    if (unit.id === "serving" && food.perServing && !food.per100) {
      var s = food.perServing; return { k: s.kcal * qty, p: s.p * qty, c: (s.c || 0) * qty, f: (s.f || 0) * qty };
    }
    var g = unit.grams * qty, h = food.per100 || {};
    return { k: (h.kcal || 0) * g / 100, p: (h.p || 0) * g / 100, c: (h.c || 0) * g / 100, f: (h.f || 0) * g / 100 };
  }
  function r1(x) { return Math.round((x || 0) * 10) / 10; }
  function unitText(food, qty, unitId) {
    var u = unitsFor(food).filter(function (x) { return x.id === unitId; })[0];
    if (!u) return "";
    if (u.id === "g") return r1(qty) + " g";
    if (u.id === "oz") return r1(qty) + " oz";
    return qty === 1 ? u.label : r1(qty) + " × " + u.label;
  }
  function makeEntry(food, qty, unitId, id) {
    var x = nutrition(food, qty, unitId);
    return { id: id, foodId: food.id, name: food.name, brand: food.brand || "", qty: qty, unit: unitId,
             amount: unitText(food, qty, unitId), kcal: Math.round(x.k), p: r1(x.p), c: r1(x.c), f: r1(x.f) };
  }

  /* how often each food was logged in the 14 days up to `today` */
  function useCounts(s, today) {
    var n = {};
    for (var i = 0; i < 14; i++) {
      var r = s.days[addDays(today, -i)]; if (!r) continue;
      var seen = {};
      MEALS.forEach(function (m) { (r.meals[m[0]] || []).forEach(function (e) { if (e.foodId) seen[e.foodId] = 1; }); });
      Object.keys(seen).forEach(function (id) { n[id] = (n[id] || 0) + 1; });
    }
    return n;
  }
  // recent foods, frequent ones (3+ days of the last 14) first
  function recentList(s, today) {
    var n = useCounts(s, today);
    var foods = s.recent.map(function (id) { return s.foods[id]; }).filter(Boolean);
    var freq = foods.filter(function (f) { return (n[f.id] || 0) >= 3; }).sort(function (a, b) { return n[b.id] - n[a.id]; });
    var rest = foods.filter(function (f) { return (n[f.id] || 0) < 3; });
    return freq.map(function (f) { return { food: f, frequent: true }; }).concat(rest.map(function (f) { return { food: f, frequent: false }; }));
  }

  /* weight */
  function weighIns(s) {
    return Object.keys(s.days).sort().filter(function (d) { return s.days[d].weight; }).map(function (d) { return { d: d, w: s.days[d].weight }; });
  }
  function trend(points) {
    var t = null;
    return points.map(function (p) { t = t == null ? p.w : t + ALPHA * (p.w - t); return { d: p.d, w: p.w, t: t }; });
  }
  function planWeight(settings, d) {
    var weeks = (parseISO(d) - parseISO(settings.planStart)) / 6048e5;
    return Math.max(settings.weightGoal, settings.weightStart - settings.rate * weeks);
  }

  /* the last 7 days ending on `today`; today counts only once it's over */
  function week(s, today) {
    var days = [], logged = 0, under = 0, sum = 0;
    for (var i = 6; i >= 0; i--) {
      var d = addDays(today, -i), t = totals(s, d), done = i > 0 && t.n > 0;
      days.push({ d: d, k: t.k, n: t.n, today: i === 0 });
      if (done) { logged++; sum += t.k; if (t.k <= s.settings.kcal) under++; }
    }
    return { days: days, logged: logged, under: under, avg: logged ? Math.round(sum / logged) : 0 };
  }
  function burnDays(s) {
    return Object.keys(s.days).filter(function (d) { return s.days[d].weight && totals(s, d).n > 0; }).length;
  }

  /* CSV, one row per food */
  function csv(s) {
    var rows = [["date", "meal", "food", "brand", "amount", "kcal", "protein_g", "carbs_g", "fat_g"]];
    Object.keys(s.days).sort().forEach(function (d) {
      MEALS.forEach(function (m) {
        (s.days[d].meals[m[0]] || []).forEach(function (e) { rows.push([d, m[1], e.name, e.brand || "", e.amount || "", e.kcal, e.p, e.c, e.f]); });
      });
    });
    return rows.map(function (r) {
      return r.map(function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",");
    }).join("\n");
  }

  /* food sources -> our food shape */
  function fromOFF(p, uid) {
    var n = p.nutriments || {}, kcal = n["energy-kcal_100g"];
    if (kcal == null && n["energy_100g"] != null) kcal = n["energy_100g"] / 4.184;
    if (kcal == null) return null;
    var grams = null;
    if (p.serving_quantity && (!p.serving_quantity_unit || /^(g|ml)$/i.test(p.serving_quantity_unit))) grams = +p.serving_quantity;
    else if (p.serving_size) { var m = String(p.serving_size).match(/([\d.]+)\s*(g|ml)\b/i); if (m) grams = +m[1]; }
    return { id: "off-" + (p.code || uid()), source: "off", barcode: p.code || "", name: (p.product_name || "").trim() || "Unnamed product",
             brand: (p.brands || "").split(",")[0].trim(),
             per100: { kcal: +kcal || 0, p: +(n.proteins_100g || 0), c: +(n.carbohydrates_100g || 0), f: +(n.fat_100g || 0) },
             serving: grams ? { label: p.serving_size || grams + " g", grams: grams } : null };
  }
  // USDA FoodData Central search hit (Foundation / SR Legacy values are per 100 g)
  function fromUSDA(h) {
    var get = function (nums) {
      var x = (h.foodNutrients || []).filter(function (n) { return nums.indexOf(String(n.nutrientNumber)) >= 0; })[0];
      return x ? +x.value || 0 : null;
    };
    var kcal = get(["208", "957", "958"]);
    if (kcal == null) return null;
    var name = String(h.description || "").toLowerCase().replace(/(^|[\s,(])\w/g, function (c) { return c.toUpperCase(); });
    return { id: "usda-" + h.fdcId, source: "usda", name: name, brand: "USDA",
             per100: { kcal: kcal, p: get(["203"]) || 0, c: get(["205"]) || 0, f: get(["204"]) || 0 }, serving: null };
  }
  function planFood(m) {
    return { id: "plan-" + m.id, source: "plan", planId: m.id, name: m.name, brand: "", day: m.day || "", slot: m.slot || "",
             fiber: m.fiber || 0, serving: { label: m.serving || "serving" },
             perServing: { kcal: +m.kcal || 0, p: +m.p || 0, c: +m.c || 0, f: +m.f || 0 } };
  }
  // planned meals grouped for a day; leftovers run 3 days past the plan week
  function planGroups(menu, d) {
    if (!menu || !Array.isArray(menu.meals) || d < menu.start || d > addDays(menu.end, 3)) return null;
    var g = { today: [], later: [], earlier: [], any: [] };
    menu.meals.map(planFood).forEach(function (f) {
      (f.day === "" ? g.any : f.day === d ? g.today : f.day < d ? g.earlier : g.later).push(f);
    });
    g.earlier.sort(function (a, b) { return a.day < b.day ? 1 : -1; });
    g.later.sort(function (a, b) { return a.day < b.day ? -1 : 1; });
    return g;
  }

  var api = { MEALS: MEALS, ALPHA: ALPHA, TDEE_DAYS: TDEE_DAYS, blank: blank, norm: norm, dayRec: dayRec,
              iso: iso, parseISO: parseISO, addDays: addDays, totals: totals, remaining: remaining,
              unitsFor: unitsFor, nutrition: nutrition, unitText: unitText, makeEntry: makeEntry, r1: r1,
              useCounts: useCounts, recentList: recentList, weighIns: weighIns, trend: trend, planWeight: planWeight,
              week: week, burnDays: burnDays, csv: csv, fromOFF: fromOFF, fromUSDA: fromUSDA, planFood: planFood,
              planGroups: planGroups };
  if (typeof module === "object" && module.exports) module.exports = api; else root.Core = api;
})(this);
