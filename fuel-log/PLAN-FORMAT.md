# plan.json

Fuel Log reads `plan.json` from this folder every time it opens. The meal-prep planner in the
secondbrain vault writes it once a week is approved. The meals show up under **Planned** for
one-tap logging, and the photo estimate uses them as its first guess for what's on the plate.

The repo is public, so this file is too. Meal names and nutrition only: no family names, no notes
about who eats what.

```json
{
  "v": 1,
  "start": "2026-10-25",
  "end": "2026-10-31",
  "updated": "2026-10-24",
  "source": "secondbrain 2_Areas/Health/Meal-Prep/2026-10-24-Weekly-Plan.md",
  "meals": [
    {
      "id": "2026-10-26-chipotle-beef-bowls",
      "day": "2026-10-26",
      "slot": "d",
      "name": "Chipotle Brothy Beef Bowls",
      "serving": "1 bowl (about 2 cups, with 1/2 cup rice)",
      "kcal": 520, "p": 42, "c": 45, "f": 17, "fiber": 3,
      "components": "chuck roast, chipotle broth, black beans, white rice, cilantro, lime",
      "basis": "recipes.md estimate at 8 servings"
    }
  ]
}
```

| Field | Rule |
|---|---|
| `v` | Always `1`. |
| `start`, `end` | The plan week, `YYYY-MM-DD`. Planned stays visible 3 days past `end` for leftovers. |
| `meals[].id` | Unique, stable, lowercase with dashes. Entries already logged point at it; don't reuse an id for a different meal. |
| `day` | `YYYY-MM-DD` inside the week, or `""` for anything eaten any day (a lunch batch). |
| `slot` | `b`, `l`, `d` or `s`. |
| `serving` | **Nate's cut portion**, in US units, described so he can see it on a plate. Not the family portion. |
| `kcal`, `p`, `c`, `f`, `fiber` | Per one `serving`. Numbers, grams for macros. |
| `components` | What's visible on the plate. The photo estimate reads this. |
| `basis` | Where the numbers came from, so a wrong one can be traced. |

Sides that aren't part of the recipe (pasta under the parm, a dinner roll) are left out and logged
separately. Say so in `basis`.

Run `python3 fuel-log/check_plan.py` before pushing.
