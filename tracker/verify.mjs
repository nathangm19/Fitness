// Verifier: runs every case under "Test cases" in SPEC.md against the built app in a headless
// phone-sized Chromium, with the food databases and the meal plan mocked, then prints a match rate.
// It never edits the app or the spec. Run from the repo root:  node tracker/verify.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const req = createRequire(import.meta.url);
const C = req("./core.js");
const { chromium } = req("playwright");   // CommonJS require, so a global install is found too

/* static server for the repo, so ../fuel-log/plan.json resolves like it does on GitHub Pages */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  let p = path.join(repo, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (p.startsWith(repo) && fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!p.startsWith(repo) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const URL0 = `http://127.0.0.1:${server.address().port}/tracker/`;

const T = C.iso(new Date()), Y = C.addDays(T, -1);
const entry = (name, kcal, p = 0, extra = {}) => ({ id: name + Math.random().toString(36).slice(2, 6), foodId: null, name, brand: "", qty: 1, unit: "serving", amount: "1 serving", kcal, p, c: 0, f: 0, ...extra });
const state = (days = {}, more = {}) => { const s = C.blank(); s.days = days; return Object.assign(s, more); };
const dayOf = (meals = {}, extra = {}) => ({ meals: { b: [], l: [], d: [], s: [], ...meals }, exercise: [], ...extra });

/* mocks */
const OFF_PRODUCTS = {
  "0123456789012": { product_name: "Test Protein Bar", brands: "Acme", nutriments: { "energy-kcal_100g": 400, proteins_100g: 33, carbohydrates_100g: 40, fat_100g: 12 }, serving_size: "50 g", serving_quantity: 50 },
  "0222222222222": { product_name: "Plain Chicken", brands: "Farm", nutriments: { "energy-kcal_100g": 165, proteins_100g: 31, carbohydrates_100g: 0, fat_100g: 3.6 } }
};
const USDA_SEARCH = { foods: [{ fdcId: 171477, description: "CHICKEN, BROILERS OR FRYERS, BREAST, MEAT ONLY, COOKED, ROASTED", foodNutrients: [
  { nutrientNumber: "208", value: 165 }, { nutrientNumber: "203", value: 31 }, { nutrientNumber: "205", value: 0 }, { nutrientNumber: "204", value: 3.6 }] }] };
const OFF_SEARCH = { products: [{ code: "999", product_name: "Chicken Breast Strips", brands: "Brand", nutriments: { "energy-kcal_100g": 120, proteins_100g: 22 } }] };
const PLAN = { v: 1, start: C.addDays(T, -2), end: C.addDays(T, 4), updated: T, source: "test", meals: [
  { id: "t-skillet", day: T, slot: "d", name: "Beef and cabbage skillet", serving: "double portion", kcal: 600, p: 54, c: 20, f: 30, fiber: 12, components: "", basis: "test" },
  { id: "t-salmon", day: C.addDays(T, 1), slot: "d", name: "Salmon with greens", serving: "1 fillet", kcal: 440, p: 38, c: 5, f: 25, fiber: 1, components: "", basis: "test" }] };

const browser = await chromium.launch();
const pageErrors = [];   // any uncaught script error fails the case it happened in
async function open(seed = {}, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", e => pageErrors.push(String(e).split("\n")[0]));
  await page.route("**/fonts.googleapis.com/**", r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("**/world.openfoodfacts.org/api/v2/product/**", r => {
    const code = r.request().url().match(/product\/(\d+)/)[1], p = OFF_PRODUCTS[code];
    r.fulfill({ json: p ? { status: 1, product: p } : { status: 0 } });
  });
  await page.route("**/world.openfoodfacts.org/cgi/search.pl**", r => r.fulfill({ json: OFF_SEARCH }));
  await page.route("**/api.nal.usda.gov/**", r => r.fulfill({ json: USDA_SEARCH }));
  await page.route("**/fuel-log/plan.json", r => opts.plan ? r.fulfill({ json: opts.plan }) : r.fulfill({ status: 404, body: "" }));
  await page.goto(URL0);
  await page.evaluate(seed => { localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v)); }, seed);
  await page.reload();
  await page.waitForSelector("#ring-num");
  return page;
}
const S = page => page.evaluate(() => window.__tracker.state());
const text = (page, sel) => page.locator(sel).first().innerText();
const mealSub = (page, i) => page.locator("#meals .section").nth(i).locator(".section-head .sub").innerText();
async function quickAdd(page, meal, k, p = "", c = "", f = "") {
  await page.click(`[data-add="${meal}"]`);
  await page.click('.tile[data-panel="quick"]');
  await page.fill("#qa-k", String(k)); await page.fill("#qa-p", String(p)); await page.fill("#qa-c", String(c)); await page.fill("#qa-f", String(f));
  await page.click("#p-quick .btn");
  await page.waitForTimeout(450);
}

const cases = {
  async T1() {
    const p = await open();
    let i = 0; for (const m of ["b", "l", "d", "s"]) await quickAdd(p, m, 100 * ++i);
    const subs = [await mealSub(p, 0), await mealSub(p, 1), await mealSub(p, 2), await mealSub(p, 3)];
    return [subs.join(",") === "100,200,300,400", subs.join(",")];
  },
  async T2() {
    const p = await open({ "tracker-v1": state({ [T]: dayOf({ l: [entry("A", 1000)], d: [entry("B", 450)] }) }) });
    const v = [await text(p, "#ring-num"), await text(p, "#ring-lab")];
    return [v.join(" ") === "550 left", v.join(" ")];
  },
  async T3() {
    const p = await open({ "tracker-v1": state({ [T]: dayOf({ d: [entry("Big dinner", 2150)] }) }) });
    const v = [await text(p, "#ring-num"), await text(p, "#ring-lab")];
    return [v.join(" ") === "150 over", v.join(" ")];
  },
  async T4() {
    const s = state({ [T]: dayOf({ l: [entry("A", 1450)] }, { exercise: [{ name: "Walk", min: 45, kcal: 300 }] }) });
    s.settings.exBack = true;
    const p = await open({ "tracker-v1": s });
    const v = await text(p, "#ring-num");
    return [v === "850", v];
  },
  async T5() {
    const p = await open({ "tracker-v1": state({ [T]: dayOf({ l: [entry("Chicken", 500, 100)] }) }) });
    const v = await text(p, "#mv-p");
    return [v === "100 / 140 g", v];
  },
  async T6() {
    const s = state(); s.foods["my-1"] = { id: "my-1", source: "custom", name: "Chicken breast bowl", brand: "", serving: { label: "1 bowl" }, perServing: { kcal: 520, p: 45, c: 40, f: 15 } };
    const p = await open({ "tracker-v1": s });
    await p.click("#add-top"); await p.fill("#q", "chicken breast"); await p.press("#q", "Enter");
    await p.waitForSelector("#p-search .list:nth-of-type(2)", { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(300);
    const titles = await p.locator("#p-search .row-title").allInnerTexts(), eyebrows = await p.locator("#p-search .eyebrow").allInnerTexts();
    const ok = titles[0] === "Chicken breast bowl" && eyebrows.some(e => /USDA/.test(e)) && titles.some(t => /Chicken, Broilers/i.test(t));
    return [ok, titles.slice(0, 3).join(" | ")];
  },
  async T7() {
    const p = await open();
    await p.click("#add-top"); await p.click('.tile[data-panel="scan"]'); await p.fill("#bc", "0123456789012"); await p.click("#bc-form .pill");
    await p.waitForSelector("#sheet-food.on", { timeout: 4000 }).catch(() => {});
    const v = await text(p, "#fd-name");
    return [v === "Test Protein Bar", v];
  },
  async T8() {
    const p = await open();
    await p.click("#add-top"); await p.click('.tile[data-panel="scan"]'); await p.fill("#bc", "0555555555555"); await p.click("#bc-form .pill");
    await p.waitForTimeout(600);
    const vis = await p.isVisible("#p-custom"), bc = await p.inputValue("#cf-bc");
    return [vis && bc === "0555555555555", `form ${vis}, barcode ${bc}`];
  },
  async T9() {
    const s = state(); s.foods["my-2"] = { id: "my-2", source: "custom", name: "Snack box", brand: "", serving: { label: "1 box" }, perServing: { kcal: 200, p: 10, c: 20, f: 8 } };
    const p = await open({ "tracker-v1": s });
    await p.click('[data-add="s"]'); await p.click('#add-seg [data-l="mine"]'); await p.click("#add-list .row >> text=Snack box");
    await p.fill("#fd-qty", "1.5"); const sheet = await text(p, "#fd-k");
    await p.click("#fd-add"); await p.waitForTimeout(450);
    const e = (await S(p)).days[T].meals.s[0];
    return [sheet === "300" && e && e.kcal === 300, `sheet ${sheet}, entry ${e && e.kcal}`];
  },
  async T10() {
    const p = await open();
    await p.click("#add-top"); await p.click('.tile[data-panel="scan"]'); await p.fill("#bc", "0222222222222"); await p.click("#bc-form .pill");
    await p.waitForSelector("#sheet-food.on", { timeout: 4000 }).catch(() => {});
    await p.selectOption("#fd-unit", "g"); await p.fill("#fd-qty", "150");
    const v = await text(p, "#fd-k");
    return [v === "248", v];
  },
  async T11() {
    const s = state();
    s.foods.oats = { id: "oats", source: "custom", name: "Oats", serving: { label: "1 cup" }, perServing: { kcal: 300, p: 10, c: 50, f: 5 } };
    s.foods.bar = { id: "bar", source: "custom", name: "Granola bar", serving: { label: "1 bar" }, perServing: { kcal: 190, p: 4, c: 30, f: 7 } };
    s.recent = ["bar", "oats"];
    [1, 4, 9].forEach(n => { s.days[C.addDays(T, -n)] = dayOf({ b: [entry("Oats", 300, 10, { foodId: "oats" })] }); });
    s.days[C.addDays(T, -2)] = dayOf({ s: [entry("Granola bar", 190, 4, { foodId: "bar" })] });
    const p = await open({ "tracker-v1": s });
    await p.click("#add-top"); await p.click('#add-seg [data-l="recent"]');
    const first = await text(p, "#add-list .row-title");
    return [/^Oats/.test(first) && /Frequent/.test(first), first.replace(/\n/g, " ")];
  },
  async T12() {
    const p = await open();
    await p.click("#add-top"); await p.click('#add-seg [data-l="mine"]'); await p.click("#add-list .row >> text=New food");
    await p.fill("#cf-name", "Beef bowl"); await p.fill("#cf-serv", "1 bowl"); await p.fill("#cf-k", "520"); await p.fill("#cf-p", "42");
    await p.click("#p-custom .btn"); await p.waitForTimeout(450);
    await p.click("#fd-back"); await p.waitForTimeout(400);
    const inMine = (await p.locator("#add-list .row-title").allInnerTexts()).includes("Beef bowl");
    await p.fill("#q", "beef bowl"); await p.press("#q", "Enter"); await p.waitForTimeout(500);
    const inSearch = (await p.locator("#p-search .row-title").allInnerTexts())[0] === "Beef bowl";
    return [inMine && inSearch, `my foods ${inMine}, search ${inSearch}`];
  },
  async T13() {
    const p = await open({ "tracker-v1": state({ [Y]: dayOf({ l: [entry("Bowl", 520), entry("Apple", 95)] }) }) });
    await p.click('button[aria-label="Copy yesterday\'s lunch"]'); await p.waitForTimeout(300);
    const l = (await S(p)).days[T].meals.l;
    return [l.length === 2 && l[0].kcal === 520 && l[1].kcal === 95, `${l.length} entries`];
  },
  async T14() {
    const p = await open();
    await quickAdd(p, "d", 600, 40, 50, 25);
    const e = (await S(p)).days[T].meals.d[0];
    return [e && e.kcal === 600 && e.p === 40 && e.c === 50 && e.f === 25, JSON.stringify(e && [e.kcal, e.p, e.c, e.f])];
  },
  async T15() {
    const s = state({ [C.addDays(T, -2)]: dayOf({}, { weight: 198 }), [Y]: dayOf({}, { weight: 197 }), [T]: dayOf({}, { weight: 199 }) });
    const p = await open({ "tracker-v1": s });
    await p.click('.tabbar [data-v="progress"]');
    const v = (await text(p, "#w-trend")).replace(/\s+/g, " ");
    return [v === "198.0 lb", v];
  },
  async T16() {
    const p = await open({ "tracker-v1": state({ [Y]: dayOf({ l: [entry("Soup", 300)] }), [T]: dayOf({ l: [entry("Tea", 100)] }) }) });
    await p.click("#prev"); await p.click("#meals .row >> text=Soup"); await p.fill("#fd-qty", "2"); await p.click("#fd-add"); await p.waitForTimeout(400);
    const s = await S(p), y = s.days[Y].meals.l[0].kcal, t = s.days[T].meals.l[0].kcal, title = await text(p, "#day-title");
    return [y === 600 && t === 100 && title === "Yesterday", `yesterday ${y}, today ${t}, showing ${title}`];
  },
  async T17() {
    const p = await open();
    const disabled = await p.isDisabled("#next");
    await p.click("#next", { force: true }).catch(() => {});
    const title = await text(p, "#day-title");
    return [title === "Today" && disabled, `${title}, next disabled ${disabled}`];
  },
  async T18() {
    const p = await open({ "tracker-v1": state({ [T]: dayOf({ b: [entry("A", 100)], l: [entry("B", 200)], d: [entry("C, with comma", 300)], s: [entry("D", 400)] }) }) });
    await p.click('.tabbar [data-v="me"]');
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#d-csv")]);
    const body = fs.readFileSync(await dl.path(), "utf8").split("\n");
    return [body.length === 5 && body[0].startsWith("date,meal,food") && body[3].includes('"C, with comma"'), `${body.length} lines`];
  },
  async T19() {
    const s = state({ [T]: dayOf({ l: [entry("Keep me", 321)] }) });
    const p = await open({ "tracker-v1": s });
    await p.click('.tabbar [data-v="me"]');
    await p.setInputFiles("#d-imp", { name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
    await p.waitForTimeout(300);
    const msg = await text(p, "#toast"), kept = (await S(p)).days[T].meals.l[0].name;
    return [/isn't a Tracker/.test(msg) && kept === "Keep me", `${msg} / ${kept}`];
  },
  async T20() {
    const p = await open({}, { plan: PLAN });
    await p.waitForTimeout(400);
    await p.click('.tabbar [data-v="plan"]');
    const groups = await p.locator("#plan-body .eyebrow").allInnerTexts(), firstRow = await text(p, "#plan-body .row-title");
    await p.click('.tabbar [data-v="today"]');
    await p.click('button[aria-label="Log Beef and cabbage skillet"]'); await p.waitForTimeout(300);
    const d = (await S(p)).days[T].meals.d[0];
    return [groups[0] === "TODAY" && firstRow === "Beef and cabbage skillet" && d && d.kcal === 600, `${groups[0]} / ${firstRow} / logged ${d && d.kcal}`];
  },
  async T21() {
    const days = {}; [1900, 1950, 1800, 2100, 1700, 1990].forEach((k, i) => { days[C.addDays(T, -(i + 1))] = dayOf({ d: [entry("Day", k)] }); });
    const p = await open({ "tracker-v1": state(days) });
    await p.click('.tabbar [data-v="progress"]');
    const v = await text(p, "#wk-sub");
    return [/5 of 6 under/.test(v), v];
  },
  async T22() {
    const p = await open({ "fuel-log-v1": state({ [Y]: dayOf({ d: [entry("From Fuel Log", 640)] }) }) });
    const s = await S(p), had = s.days[Y] && s.days[Y].meals.d[0].name === "From Fuel Log";
    const stored = await p.evaluate(() => !!localStorage.getItem("tracker-v1"));
    return [had && stored, `carried ${had}, stored ${stored}`];
  },
  async T23() {
    const days = {}; [1, 2, 3, 4].forEach(n => { days[C.addDays(T, -n)] = dayOf({ d: [entry("Dinner", 600)] }, { weight: 197 }); });
    days[C.addDays(T, -5)] = dayOf({}, { weight: 197 });
    const p = await open({ "tracker-v1": state(days) });
    await p.click('.tabbar [data-v="progress"]');
    const v = await text(p, "#burn-text");
    return [/4 of 21 days/.test(v), v];
  }
};

const results = [];
for (const [id, fn] of Object.entries(cases)) {
  let ok = false, detail = "";
  pageErrors.length = 0;
  try { [ok, detail] = await fn(); } catch (e) { detail = "crash: " + String(e.message || e).split("\n")[0]; }
  if (pageErrors.length) { ok = false; detail = "crash: script error " + pageErrors[0]; }
  results.push({ id, ok, detail });
  console.log(`${ok ? "pass" : "FAIL"}  ${id}  ${detail}`);
}
await browser.close(); server.close();
const passed = results.filter(r => r.ok).length;
console.log(`\nmatch ${passed} / ${results.length}  ${(passed / results.length * 100).toFixed(1)}%`);
console.log(`RESULT wrong=${results.filter(r => !r.ok && !r.detail.startsWith("crash")).length} crash=${results.filter(r => r.detail.startsWith("crash")).length}`);
process.exit(passed === results.length ? 0 : 1);
