"""Gate for fuel-log/plan.json. Exit 1 on any problem, so a broken plan never reaches the phone."""
import json, re, sys, datetime, pathlib

path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).with_name("plan.json"))
bad = []
try:
    plan = json.loads(path.read_text())
except Exception as e:
    sys.exit(f"FAIL {path}: not JSON ({e})")

def date(s, where):
    try:
        return datetime.date.fromisoformat(s)
    except Exception:
        bad.append(f"{where}: '{s}' is not YYYY-MM-DD")

if plan.get("v") != 1:
    bad.append("v must be 1")
start, end = date(plan.get("start", ""), "start"), date(plan.get("end", ""), "end")
if start and end and not (0 <= (end - start).days <= 13):
    bad.append("end must be 0-13 days after start")
meals = plan.get("meals")
if not isinstance(meals, list) or not meals:
    bad.append("meals must be a non-empty list")
    meals = []
ids = set()
for i, m in enumerate(meals):
    w = f"meals[{i}] {m.get('name', '?')}"
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", str(m.get("id", ""))):
        bad.append(f"{w}: id must be lowercase letters, digits, dashes")
    if m.get("id") in ids:
        bad.append(f"{w}: duplicate id {m.get('id')}")
    ids.add(m.get("id"))
    if not str(m.get("name", "")).strip():
        bad.append(f"{w}: name is empty")
    if not str(m.get("serving", "")).strip():
        bad.append(f"{w}: serving is empty")
    if m.get("slot", "") not in ("b", "l", "d", "s"):
        bad.append(f"{w}: slot must be b, l, d or s")
    if m.get("day"):
        d = date(m["day"], w)
        if d and start and end and not (start <= d <= end):
            bad.append(f"{w}: day {m['day']} is outside {plan['start']}..{plan['end']}")
    for k in ("kcal", "p", "c", "f"):
        if not isinstance(m.get(k), (int, float)) or m[k] < 0:
            bad.append(f"{w}: {k} must be a number >= 0")
    if all(isinstance(m.get(k), (int, float)) for k in ("kcal", "p", "c", "f")):
        # sniff test: stated calories should roughly match the macros (4/4/9), and a portion over 1,500 kcal is a family portion
        mac = 4 * m["p"] + 4 * m["c"] + 9 * m["f"]
        if m["kcal"] and not (0.75 <= mac / m["kcal"] <= 1.3):
            bad.append(f"{w}: macros give {mac:.0f} kcal but kcal says {m['kcal']} (check c and f)")
        if m["kcal"] > 1500:
            bad.append(f"{w}: {m['kcal']} kcal is a family portion, not Nate's")
    if re.search(r"\b(Palmira|Jaxin|Malakai|Ishmael)\b", json.dumps(m)):
        bad.append(f"{w}: family names don't go in a public file")

if bad:
    print("\n".join("FAIL " + b for b in bad))
    sys.exit(1)
print(f"OK {path.name}: {len(meals)} meals, {plan['start']} to {plan['end']}")
