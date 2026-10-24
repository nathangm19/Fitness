# Fuel Log

A food diary for the phone. Calories against a ceiling, protein against a target, barcode scan,
weight trend. Live at https://nathangm19.github.io/Fitness/fuel-log/

## What it does

- **Day ledger**: Goal − Food + Exercise = Remaining, with protein, carbs and fat bars.
- **Four meals**: Breakfast, Lunch, Dinner, Snacks. Tap an entry to change the amount or remove it.
  "Copy yesterday's lunch" repeats a meal-prep day in one tap.
- **Add food**:
  - Search Open Food Facts. Your own foods and past foods come up first.
  - Scan a barcode with the camera, take a photo of one, or type the number.
  - Recent foods remember the amount you used last time.
  - My foods holds home recipes and meal-prep bowls. A barcode that isn't found can be saved here
    and it scans next time, even offline.
  - Quick add takes calories and protein with no food entry, for restaurant meals.
- **Exercise** is logged but not added back to the goal unless you turn that on under Goals.
- **Weight**: morning weigh-ins with a smoothed trend line, compared with the 198 → 180 plan at
  1.5 lb a week from 2026-10-18.
- **This week**: seven-day bars, average calories, days under the ceiling, average protein.

Defaults are a 2,000 kcal ceiling and 140 g protein. Change them under "Goals, data and backup".

## Data

Everything is stored in the phone's browser (localStorage key `fuel-log-v1`). Nothing is sent
anywhere except food searches and barcode lookups, which go to Open Food Facts. Back up to JSON
and restore from the same menu. The CSV export is the full diary, one row per food.

Clearing the browser's site data for this page deletes the diary, so back up now and then.

## Install

Open the link in Chrome on the phone, then menu → Add to Home screen. It opens full screen and the
shell works offline. The camera scanner needs Chrome on Android. On other browsers, use the photo
or type-the-number option.

## Food data

Nutrition comes from [Open Food Facts](https://world.openfoodfacts.org), a free, open database
built by volunteers (ODbL). Entries can be wrong or missing. Check the label for anything that
matters, and save a corrected version under My foods.

## Files

- `index.html` – the whole app
- `sw.js` – offline cache for the app shell
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png` – home-screen install
