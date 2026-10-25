# Tracker — core parity spec

What the app must do for the first release: the MyFitnessPal behaviour Nate uses every day,
written as testable requirements. Numbers in brackets are the checklist items in the plan doc.
`verify.mjs` runs every case under Test cases in a headless phone browser and prints a match rate.

Behaviour comes from MFP's public features and from `secondbrain/2_Areas/Health/Tracker-Spec.md`
(trend weight, the rules about never scoring protein or steps). No MFP code or data is used.

## Architecture

- A static web app in `tracker/`, served from GitHub Pages next to Fuel Log, installable to the
  home screen, offline after the first load.
- Data lives in the browser under `tracker-v1`. Same origin as Fuel Log, so on first open the app
  copies `fuel-log-v1` across if it has no data of its own. Fuel Log's data is never changed.
- Food data: Open Food Facts (packaged foods, barcodes) and USDA FoodData Central (generic foods).
  Meal plan: `../fuel-log/plan.json`, written by the secondbrain meal-prep planner.
- `core.js` holds all the arithmetic as pure functions so it can be tested without a browser.

## Data model

```
state    { v: 1, days: {YYYY-MM-DD: day}, foods: {id: food}, recent: [foodId],
           settings: { kcal, protein, carbs, fat, exBack, weightStart, weightGoal, rate, planStart } }
day      { meals: { b: [entry], l: [entry], d: [entry], s: [entry] }, exercise: [{name, min, kcal}], weight? }
entry    { id, foodId, name, brand, qty, unit, amount, kcal, p, c, f }
food     { id, source: off|usda|custom|plan|quick, name, brand, barcode?, per100?, perServing?,
           serving?: {label, grams?}, lastQty?, lastUnit? }
```

The shape matches Fuel Log's `fuel-log-v1`, so an import is a copy.

## Requirements

- **R1 Diary by meal [1].** Breakfast, Lunch, Dinner, Snacks, each with its own calorie subtotal.
  An empty meal says "Nothing yet".
- **R2 Remaining [2].** Remaining = ceiling − food + exercise when "add exercise back" is on,
  otherwise ceiling − food. Over the ceiling shows "over" with the amount, never a negative.
- **R3 Macros [3].** Protein, carbs and fat each show eaten / goal and a bar. A goal of 0 shows the
  grams with no bar. Protein is never coloured as a failure.
- **R4 Search [4].** Typing a query searches My foods and past foods first, then Open Food Facts
  and USDA together. Results show name, brand and calories per serving.
- **R5 Barcode [5].** A scanned or typed barcode looks in My foods first, then Open Food Facts.
  Not found: offer to save it as a custom food with that barcode.
- **R6 Servings [6].** A food opens a detail sheet: amount, unit (serving, grams, ounces where the
  food has per-100 g data) and live calories and macros. 1.5 servings of a 200 kcal serving = 300.
- **R7 Recent and frequent [7].** Recent lists the last 40 foods used. A food logged 3 or more
  times in the last 14 days is marked frequent and sorts first.
- **R8 Custom foods [8].** Name, serving, calories, protein, carbs, fat. Saved foods appear under
  My foods and in search.
- **R9 Copy a meal [11].** An empty meal offers "Same as yesterday" when yesterday's meal had food.
- **R10 Quick add [12].** Name, calories, protein, carbs, fat. Logged as one entry.
- **R11 Weight [14].** One weight per day (80–500 lb). Progress shows the raw mornings as dots
  and the trend line: trend[0] = w[0], trend[n] = trend[n−1] + 0.1 × (w[n] − trend[n−1]). The
  headline number is the trend, never the raw reading.
- **R12 Past days [23].** Previous / next day buttons; next stops at today. Any entry on any day
  can be edited or removed.
- **R13 Export [26].** CSV with one row per food: date, meal, food, brand, amount, kcal, protein,
  carbs, fat. JSON backup and restore of the whole state.
- **R14 Photo [29].** A plate photo goes to Gemini with this week's planned meals as context;
  items come back editable and can be unticked before adding. The key stays on the phone.
- **R15 Planned meals.** The Plan tab and the Add sheet list this week's meals from `plan.json`
  with Nate's portion; one tap opens the detail sheet. Leftovers show for 3 days past the week.
- **R16 Week.** Progress shows the last 7 days as bars against the ceiling, the average of logged
  days, and how many logged days were under the ceiling. Today counts only once it is over.
- **R17 Real burn (calibrating).** Progress shows how many of the 21 days needed for an adaptive
  TDEE are logged (days with both food and a weight). Under 21 it says the ceiling stays put.

## Errors

- Network failure on search or barcode: a plain line saying what failed and pointing to Quick add.
- Storage full or blocked: say the entry wasn't saved.
- A restore file that isn't a backup: say so and change nothing.

## Test cases

| Id | Req | Input | Expected |
|---|---|---|---|
| T1 | R1 | Add one food to each of the four meals | Each meal shows its own subtotal |
| T2 | R2 | Ceiling 2,000, food 1,450, exercise 0 | Ring centre reads 550, "left" |
| T3 | R2 | Ceiling 2,000, food 2,150 | Ring centre reads 150, "over" |
| T4 | R2 | Food 1,450, exercise 300, add-back on | 850 left |
| T5 | R3 | 100 g protein against 140 g | "100 / 140 g" |
| T6 | R4 | Search "chicken breast" with OFF and USDA mocked | USDA generic result appears, custom food match first |
| T7 | R5 | Type a barcode mocked in OFF | Detail sheet opens on that product |
| T8 | R5 | Type an unknown barcode | Custom food form opens with the barcode filled |
| T9 | R6 | 1.5 servings of a 200 kcal food | Sheet shows 300 kcal; diary entry 300 |
| T10 | R6 | 150 g of a food at 165 kcal / 100 g | 248 kcal |
| T11 | R7 | Same food logged on 3 of the last 14 days | Marked frequent, listed first in Recent |
| T12 | R8 | Save custom food "Beef bowl" 520 kcal | Appears under My foods and in search |
| T13 | R9 | Yesterday's lunch had 2 foods, today's empty | "Same as yesterday" copies both |
| T14 | R10 | Quick add 600 / 40 / 50 / 25 | One entry with those numbers |
| T15 | R11 | Weights 198, 197, 199 on three days | Trend 198.01 → headline 198.0 |
| T16 | R12 | Go back a day, edit an entry's amount | That day's total changes; today's doesn't |
| T17 | R12 | On today, press next | Stays on today |
| T18 | R13 | Export CSV after T1 | Header row plus 4 food rows |
| T19 | R13 | Restore a file that isn't a backup | Error shown, data unchanged |
| T20 | R15 | plan.json with a meal for today | Shows under Today in the Plan tab, logs in one tap |
| T21 | R16 | 6 logged days, 5 under the ceiling | "5 of 6 under" |
| T22 | — | Fuel Log data present, tracker empty | Diary carried over on first open |
| T23 | R17 | 4 days with food and weight | "4 of 21 days" |

## Open questions

- Which app is the calorie record going forward, this one or the Habit Tracker.
- Saving to life-os: endpoint shape and auth, once Nate confirms life-os as the store.
