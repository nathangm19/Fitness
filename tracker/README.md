# Tracker

Food diary for the phone, built to do what MyFitnessPal does for Nate and then go past it.
Live at https://nathangm19.github.io/Fitness/tracker/ once merged.

## What it does now

- **Today**: one calorie ring against the 2,000 ceiling, protein, carbs and fat bars, four meals.
  An empty meal offers this week's planned dish in one tap, or a copy of yesterday's.
- **Add food**: search (your foods first, then USDA generic foods and Open Food Facts packaged
  foods), barcode scan or typed barcode, plate photo through Gemini, quick add with full macros,
  Planned / Recent / My foods. Foods logged on 3 of the last 14 days are marked Frequent.
- **Food sheet**: amount with a stepper, unit (serving, grams, ounces), live numbers and what's
  left for the day after adding it.
- **Plan**: this week's cooking from `../fuel-log/plan.json`, with your portions.
- **Progress**: trend weight against the plan line, the week's calories, and a count toward the
  21 days of food and weight the adaptive burn estimate needs.
- **Me**: goals, keys, CSV export, JSON backup and restore.

Past days: the arrows at the top. Light and dark follow the phone.

## Data

Stored in this phone's browser under `tracker-v1`. On first open it copies the Fuel Log diary
(`fuel-log-v1`, same site) so nothing is lost; Fuel Log's copy is left as is. Keys for Gemini and
USDA are stored separately and never go into backups. Food searches go to Open Food Facts and
USDA; plate photos go to Gemini only when you ask for an estimate.

## Files

- `SPEC.md`: what the app must do, with the test cases
- `core.js`: all the arithmetic, no page code
- `app.js`, `app.css`, `index.html`: the app
- `verify.mjs`: runs every spec test in a headless phone browser and prints the match rate.
  `node tracker/verify.mjs` from the repo root (needs Playwright)
- `sw.js`, `manifest.webmanifest`, icons: offline and home-screen install
