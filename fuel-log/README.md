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
  - **Planned** lists this week's home-cooked meals from the meal plan, with Nate's portion and its
    numbers. Today's meals come first, then leftovers, then later in the week.
  - **Photo** sends a picture of the plate to Google Gemini. Gemini names each food, estimates the
    portion, and matches anything it recognises from this week's plan, which gives much better numbers
    than a cold guess. Check and fix the numbers, untick what you didn't eat, then add.
- **Exercise** is logged but not added back to the goal unless you turn that on under Goals.
- **Weight**: morning weigh-ins with a smoothed trend line, compared with the 198 → 180 plan at
  1.5 lb a week from 2026-10-18.
- **This week**: seven-day bars, average calories, days under the ceiling, average protein.

Defaults are a 2,000 kcal ceiling and 140 g protein. Change them under "Goals, data and backup".

## Data

Everything is stored in the phone's browser (localStorage key `fuel-log-v1`). Nothing is sent
anywhere except food searches and barcode lookups, which go to Open Food Facts, and meal photos,
which go to Google Gemini when you ask for an estimate. Back up to JSON
and restore from the same menu. The CSV export is the full diary, one row per food.

Clearing the browser's site data for this page deletes the diary, so back up now and then.

## Meal plan

`plan.json` in this folder is this week's cooking. The meal-prep planner in the secondbrain vault
writes it each time a week is approved; the format is in [PLAN-FORMAT.md](PLAN-FORMAT.md) and
`check_plan.py` checks it before it's pushed. The app picks up a new plan the next time it opens and
keeps the last one for offline use. This repo is public, so the file holds meal names and nutrition
only.

## Photo estimates

Needs a Gemini API key, saved under Goals, data and backup. Make a separate key for this at
https://aistudio.google.com/apikey, and in Google Cloud restrict it to the Generative Language API
and to the website `https://nathangm19.github.io/*`. The key stays on the phone and is left out of
backups. On the free tier each model allows about 20 photos a day; the app moves to the next model
when one is busy or used up. The photo itself isn't stored.

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
- `plan.json` – this week's meal plan; `PLAN-FORMAT.md`, `check_plan.py` – its format and checker
- `sw.js` – offline cache for the app shell
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png` – home-screen install
