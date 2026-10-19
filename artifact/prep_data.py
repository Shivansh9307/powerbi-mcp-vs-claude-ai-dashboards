"""
F1 Evolution - data preparation
===========================
Reads the raw Kaggle-style Formula 1 CSVs and writes compact, analysis-ready CSVs
(`data/*.csv`) that the dashboard loads as its datasets.

Nothing is invented: every output value is a copy, a unit conversion, a join or an
aggregate of raw columns.  '\\N' (the source's NULL token) becomes an EMPTY cell, which
the dashboard reads as "missing" - never as zero.

Usage:  python prep_data.py <raw_csv_dir> <out_dir>
"""

import collections
import csv
import html
import os
import re
import statistics
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
NULL = chr(92) + "N"
os.makedirs(OUT, exist_ok=True)


# ----------------------------------------------------------------------------
# generic helpers (cleaning)
# ----------------------------------------------------------------------------
def nz(v):
    """raw cell -> None when NULL token / blank, else the stripped text."""
    if v is None:
        return None
    v = v.strip()
    return None if v == NULL or v == "" else v


def to_int(v):
    v = nz(v)
    return None if v is None else int(float(v))


def to_float(v):
    v = nz(v)
    return None if v is None else float(v)


def classified_pos(position_text, position):
    """Classified position. positionText is the source of truth: a digit string = classified at that position.
    The raw `position` column is blank for retirements before 2025 but filled for R/D/W rows in 2025-2026,
    so it cannot be used on its own (see dq_text)."""
    pt = (position_text or "").strip()
    return int(pt) if pt.isdigit() else None


def lap_ms(v):
    """'1:26.572' / '26.572' -> milliseconds (int) or None."""
    v = nz(v)
    if v is None:
        return None
    parts = v.split(":")
    try:
        if len(parts) == 2:
            return round((int(parts[0]) * 60 + float(parts[1])) * 1000)
        return round(float(parts[0]) * 1000)
    except ValueError:
        return None


def clean_text(v):
    return html.unescape(nz(v) or "")


def read_rows(name):
    with open(os.path.join(SRC, name + ".csv"), encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def write_csv(name, header, rows):
    path = os.path.join(OUT, name + ".csv")
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(header)
        for r in rows:
            w.writerow(["" if x is None else x for x in r])
    print(f"  wrote {name}.csv  {len(rows):>7} rows  {os.path.getsize(path) / 1024:8.0f} KB")


# ----------------------------------------------------------------------------
# status grouping.  Priority:  positionText F/W -> DNS ; D/E -> DSQ ; else statusId map
#   0 FIN finished (lead lap)   1 LAP lapped (classified a lap+ down)
#   2 MEC mechanical DNF        3 ACC accident DNF
#   4 DSQ disqualified/excluded 5 OTH other DNF (retired/unclassified/injury/illness...)
#   6 DNS did not start / qualify / prequalify / withdrew before the start
# ----------------------------------------------------------------------------
ACCIDENT = {3, 4, 20, 104, 130, 137, 138}
OTHER = {31, 62, 54, 73, 82, 100, 107, 139, 68, 78, 89, 90}
DSQ_IDS = {2, 92, 96}
SG_NAMES = ["Finished", "Lapped", "Mechanical DNF", "Accident DNF", "Disqualified", "Other DNF", "Did not start"]


def status_group(status_id, status_text, position_text):
    if position_text in ("F", "W"):
        return 6
    if position_text in ("D", "E") or status_id in DSQ_IDS:
        return 4
    if status_id == 1:
        return 0
    if re.match(r"^\+\d+ Laps?$", status_text or ""):
        return 1
    if status_id in ACCIDENT:
        return 3
    if status_id in OTHER:
        return 5
    return 2


# ----------------------------------------------------------------------------
# load dimensions
# ----------------------------------------------------------------------------
print("loading raw tables ...")
drivers = read_rows("drivers")
constructors = read_rows("constructors")
circuits = read_rows("circuits")
status = read_rows("status")
races = read_rows("races")
seasons = read_rows("seasons")
results = read_rows("results")
sprints = read_rows("sprint_results")
qualifying = read_rows("qualifying")
pits = read_rows("pit_stops")
dstd = read_rows("driver_standings")
cstd = read_rows("constructor_standings")
cres = read_rows("constructor_results")

status_text = {int(s["statusId"]): s["status"] for s in status}
race_by_id = {r["raceId"]: r for r in races}
year_of = {r["raceId"]: int(r["year"]) for r in races}

# ---- dimensions --------------------------------------------------------------
write_csv(
    "dim_drivers",
    ["id", "name", "code", "nat", "dob"],
    [
        [
            d["driverId"],
            (clean_text(d["forename"]) + " " + clean_text(d["surname"])).strip(),
            nz(d["code"]),
            clean_text(d["nationality"]),
            nz(d["dob"]),
        ]
        for d in drivers
    ],
)
write_csv(
    "dim_constructors",
    ["id", "name", "nat"],
    [[c["constructorId"], clean_text(c["name"]), clean_text(c["nationality"])] for c in constructors],
)
write_csv(
    "dim_circuits",
    ["id", "name", "loc", "country", "lat", "lng"],
    [
        [
            c["circuitId"],
            clean_text(c["name"]),
            clean_text(c["location"]),
            clean_text(c["country"]),
            nz(c["lat"]),
            nz(c["lng"]),
        ]
        for c in circuits
    ],
)
write_csv(
    "dim_status",
    ["id", "status", "group"],
    [[s["statusId"], s["status"], status_group(int(s["statusId"]), s["status"], "")] for s in status],
)

# ---- results (race grain: one row per car entry) -------------------------------
res_rows = []
for r in results:
    sid = int(r["statusId"])
    sg = status_group(sid, status_text.get(sid), r["positionText"])
    res_rows.append(
        [
            r["raceId"],
            r["driverId"],
            r["constructorId"],
            to_int(r["grid"]),
            classified_pos(r["positionText"], r["position"]),
            int(r["positionOrder"]),
            r["points"],
            to_int(r["laps"]),
            sg,
            sid,
            to_int(r["rank"]),
        ]
    )
write_csv("fact_results", ["r", "d", "c", "g", "p", "o", "pt", "l", "s", "si", "fr"], res_rows)

spr_rows = []
for r in sprints:
    sid = to_int(r["statusId"])
    sg = (
        status_group(sid, status_text.get(sid), r["positionText"]) if sid else 5
    )  # missing statusId -> Other DNF (kept visible, not dropped)
    spr_rows.append(
        [
            r["raceId"],
            r["driverId"],
            r["constructorId"],
            to_int(r["grid"]),
            classified_pos(r["positionText"], r["position"]),
            int(r["positionOrder"]),
            r["points"],
            to_int(r["laps"]),
            sg,
        ]
    )
write_csv("fact_sprints", ["r", "d", "c", "g", "p", "o", "pt", "l", "s"], spr_rows)

# ---- qualifying (driver x race) -------------------------------------------------
write_csv(
    "fact_quali",
    ["r", "d", "c", "p", "q1", "q2", "q3"],
    [
        [
            q["raceId"],
            q["driverId"],
            q["constructorId"],
            to_int(q["position"]),
            lap_ms(q["q1"]),
            lap_ms(q["q2"]),
            lap_ms(q["q3"]),
        ]
        for q in qualifying
    ],
)

# ---- pit stops (stop grain) ----------------------------------------------------
write_csv(
    "fact_pits",
    ["r", "d", "stop", "lap", "ms"],
    [[p["raceId"], p["driverId"], p["stop"], to_int(p["lap"]), to_int(p["milliseconds"])] for p in pits],
)

# ---- standings (snapshot after each race) --------------------------------------
write_csv(
    "std_drivers",
    ["r", "d", "pt", "po", "w"],
    [[s["raceId"], s["driverId"], s["points"], to_int(s["position"]), to_int(s["wins"])] for s in dstd],
)
write_csv(
    "std_constructors",
    ["r", "c", "pt", "po", "w"],
    [[s["raceId"], s["constructorId"], s["points"], to_int(s["position"]), to_int(s["wins"])] for s in cstd],
)

# ---- lap_times: stream & aggregate to race x driver ------------------------------
print("aggregating lap_times (885k rows) ...")
lap_ms_by = collections.defaultdict(list)  # (race, driver) -> [ms]
led_by = collections.Counter()  # (race, driver) -> laps with position == 1
race_laps = collections.defaultdict(list)  # race -> [ms]
race_maxlap = collections.defaultdict(int)
lap_dups = 0
seen_laps = set()
lap_cols = None
lap_nulls = collections.Counter()
lap_rows_n = 0
lap_fk_race = set()
lap_fk_driver = set()
with open(os.path.join(SRC, "lap_times.csv"), encoding="utf-8", newline="") as fh:
    rd = csv.reader(fh)
    lap_cols = next(rd)
    for row in rd:
        lap_rows_n += 1
        for c, v in zip(lap_cols, row):
            if v == NULL:
                lap_nulls[c] += 1
        rid, did, lap, pos, _t, ms = row
        key = (rid, did, lap)
        if key in seen_laps:  # exact/1-ms duplicate lap rows (2 races) -> keep the first, count the rest
            lap_dups += 1
            continue
        seen_laps.add(key)
        lap_fk_race.add(rid)
        lap_fk_driver.add(did)
        if ms != NULL:
            m = int(ms)
            lap_ms_by[(rid, did)].append(m)
            race_laps[rid].append(m)
        if pos == "1":
            led_by[(rid, did)] += 1
        race_maxlap[rid] = max(race_maxlap[rid], int(lap))
seen_laps.clear()

lap_sum_rows = []
for (rid, did), arr in lap_ms_by.items():
    arr.sort()
    lap_sum_rows.append(
        [
            rid,
            did,
            len(arr),
            arr[0],
            round(statistics.median(arr)),
            round(sum(arr) / len(arr)),
            led_by.get((rid, did), 0),
        ]
    )
for k in led_by:  # drivers with laps-led but no timed laps (not expected)
    if k not in lap_ms_by:
        lap_sum_rows.append([k[0], k[1], 0, None, None, None, led_by[k]])
lap_sum_rows.sort(key=lambda x: (int(x[0]), int(x[1])))
write_csv("fact_laps", ["r", "d", "n", "best", "med", "mean", "led"], lap_sum_rows)

# ---- races (race grain) -------------------------------------------------------
res_by_race = collections.defaultdict(list)
for r in results:
    res_by_race[r["raceId"]].append(r)
spr_by_race = collections.defaultdict(list)
for r in sprints:
    spr_by_race[r["raceId"]].append(r)
q_cnt = collections.Counter(q["raceId"] for q in qualifying)
p_cnt = collections.Counter(p["raceId"] for p in pits)

race_rows = []
for r in sorted(races, key=lambda x: (int(x["year"]), int(x["round"]))):
    rid = r["raceId"]
    rr = res_by_race.get(rid, [])
    has = 1 if rr else 0
    # winner points = sum of points of every row whose classified position is 1 (shared-win races have 2 rows)
    wpts = sum(float(x["points"]) for x in rr if classified_pos(x["positionText"], x["position"]) == 1) if rr else None
    sp = spr_by_race.get(rid, [])
    spts = sum(float(x["points"]) for x in sp if classified_pos(x["positionText"], x["position"]) == 1) if sp else None
    starters = sum(1 for x in rr if x["positionText"] not in ("F", "W"))
    laps_med = round(statistics.median(race_laps[rid])) if race_laps.get(rid) else None
    laps_best = min(race_laps[rid]) if race_laps.get(rid) else None
    win_laps = max((to_int(x["laps"]) or 0 for x in rr), default=None) if rr else None
    race_rows.append(
        [
            rid,
            r["year"],
            r["round"],
            clean_text(r["name"]),
            r["date"],
            r["circuitId"],
            has,
            len(rr),
            starters if rr else None,
            wpts,
            spts,
            1 if sp else 0,
            q_cnt.get(rid, 0),
            len(race_laps.get(rid, [])),
            p_cnt.get(rid, 0),
            laps_med,
            laps_best,
            win_laps,
        ]
    )
write_csv(
    "fact_races",
    [
        "id",
        "year",
        "round",
        "name",
        "date",
        "circuit",
        "done",
        "entries",
        "starters",
        "wpts",
        "spts",
        "sprint",
        "nq",
        "nlap",
        "npit",
        "lapmed",
        "lapbest",
        "laps",
    ],
    race_rows,
)

# ----------------------------------------------------------------------------
# DATA QUALITY datasets (statistics about the RAW files)
# ----------------------------------------------------------------------------
print("profiling raw tables ...")
tables = {
    "circuits": (circuits, ["circuitId"]),
    "constructors": (constructors, ["constructorId"]),
    "drivers": (drivers, ["driverId"]),
    "races": (races, ["raceId"]),
    "seasons": (seasons, ["year"]),
    "status": (status, ["statusId"]),
    "results": (results, ["resultId"]),
    "sprint_results": (sprints, ["resultId"]),
    "qualifying": (qualifying, ["qualifyId"]),
    "pit_stops": (pits, ["raceId", "driverId", "stop"]),
    "driver_standings": (dstd, ["driverStandingsId"]),
    "constructor_standings": (cstd, ["constructorStandingsId"]),
    "constructor_results": (cres, ["constructorResultsId"]),
}
dq_tables, dq_nulls = [], []


def year_range(rows):
    ys = [year_of[x["raceId"]] for x in rows if "raceId" in x and x["raceId"] in year_of]
    return (min(ys), max(ys)) if ys else (None, None)


def n_null_cells(rows, cols):
    c = collections.Counter()
    for x in rows:
        for k in cols:
            if x[k] == NULL:
                c[k] += 1
    return c


for name, (rows, pk) in tables.items():
    cols = list(rows[0].keys())
    nulls = n_null_cells(rows, cols)
    keys = collections.Counter(tuple(x[k] for k in pk) for x in rows)
    dup = sum(1 for v in keys.values() if v > 1)
    if name == "races" or name == "seasons":
        y0, y1 = min(int(x["year"]) for x in rows), max(int(x["year"]) for x in rows)
    else:
        y0, y1 = year_range(rows)
    dq_tables.append([name, len(rows), len(cols), "+".join(pk), dup, y0, y1, sum(nulls.values())])
    for c in cols:
        dq_nulls.append([name, c, nulls.get(c, 0), len(rows)])

# lap_times (streamed)
dq_tables.append(
    [
        "lap_times",
        lap_rows_n,
        len(lap_cols),
        "raceId+driverId+lap",
        lap_dups,
        min(year_of[r] for r in lap_fk_race),
        max(year_of[r] for r in lap_fk_race),
        sum(lap_nulls.values()),
    ]
)
for c in lap_cols:
    dq_nulls.append(["lap_times", c, lap_nulls.get(c, 0), lap_rows_n])
write_csv("dq_tables", ["table", "rows", "cols", "key", "dupKeys", "y0", "y1", "nullCells"], dq_tables)
write_csv("dq_nulls", ["table", "column", "nulls", "rows"], dq_nulls)

# foreign keys
ids = {
    "races.raceId": {x["raceId"] for x in races},
    "drivers.driverId": {x["driverId"] for x in drivers},
    "constructors.constructorId": {x["constructorId"] for x in constructors},
    "circuits.circuitId": {x["circuitId"] for x in circuits},
    "status.statusId": {x["statusId"] for x in status},
}
fk = [
    ("races", "circuitId", "circuits.circuitId", races),
    ("results", "raceId", "races.raceId", results),
    ("results", "driverId", "drivers.driverId", results),
    ("results", "constructorId", "constructors.constructorId", results),
    ("results", "statusId", "status.statusId", results),
    ("sprint_results", "raceId", "races.raceId", sprints),
    ("sprint_results", "driverId", "drivers.driverId", sprints),
    ("sprint_results", "constructorId", "constructors.constructorId", sprints),
    ("qualifying", "raceId", "races.raceId", qualifying),
    ("qualifying", "driverId", "drivers.driverId", qualifying),
    ("qualifying", "constructorId", "constructors.constructorId", qualifying),
    ("pit_stops", "raceId", "races.raceId", pits),
    ("pit_stops", "driverId", "drivers.driverId", pits),
    ("driver_standings", "raceId", "races.raceId", dstd),
    ("driver_standings", "driverId", "drivers.driverId", dstd),
    ("constructor_standings", "raceId", "races.raceId", cstd),
    ("constructor_standings", "constructorId", "constructors.constructorId", cstd),
    ("constructor_results", "raceId", "races.raceId", cres),
    ("constructor_results", "constructorId", "constructors.constructorId", cres),
]
fk_rows = []
for child, col, parent, rows in fk:
    pset = ids[parent]
    fk_rows.append([child, col, parent, len(rows), sum(1 for x in rows if x[col] not in pset)])
fk_rows.append(["lap_times", "raceId", "races.raceId", lap_rows_n, len(lap_fk_race - ids["races.raceId"])])
fk_rows.append(["lap_times", "driverId", "drivers.driverId", lap_rows_n, len(lap_fk_driver - ids["drivers.driverId"])])
write_csv("dq_fk", ["child", "col", "parent", "childRows", "unmatched"], fk_rows)

# per-season coverage (races with at least one row per table)
cov = collections.defaultdict(lambda: collections.defaultdict(set))
for r in races:
    cov[int(r["year"])]["sched"].add(r["raceId"])
for tname, rows in [
    ("results", results),
    ("sprint", sprints),
    ("quali", qualifying),
    ("pits", pits),
    ("dstd", dstd),
    ("cstd", cstd),
    ("cres", cres),
]:
    for x in rows:
        cov[year_of[x["raceId"]]][tname].add(x["raceId"])
for rid in lap_fk_race:
    cov[year_of[rid]]["laps"].add(rid)
cov_rows = []
for y in sorted(cov):
    c = cov[y]
    cov_rows.append(
        [
            y,
            len(c["sched"]),
            len(c["results"]),
            len(c["sprint"]),
            len(c["quali"]),
            len(c["laps"]),
            len(c["pits"]),
            len(c["dstd"]),
            len(c["cstd"]),
            len(c["cres"]),
        ]
    )
write_csv(
    "dq_coverage", ["year", "sched", "results", "sprint", "quali", "laps", "pits", "dstd", "cstd", "cres"], cov_rows
)

# text-encoding check: U+FFFD (replacement char) inside names
bad_driver = sum(1 for d in drivers if "�" in (d["forename"] + d["surname"]))
bad_cons = sum(1 for c in constructors if "�" in c["name"])
bad_circ = sum(1 for c in circuits if "�" in (c["name"] + c["location"] + c["country"]))
bad_race = sum(1 for r in races if "�" in r["name"])
html_ent = sum(1 for c in constructors if "&amp;" in c["name"])
bad_cls = [
    (year_of[r["raceId"]], r)
    for r in results
    if not r["positionText"].strip().isdigit() and nz(r["position"]) is not None
]
bad_cls_sp = [r for r in sprints if not r["positionText"].strip().isdigit() and nz(r["position"]) is not None]
cls_years = sorted({y for y, _ in bad_cls})
cls_label = "result rows with a position but a non-numeric positionText (R/D/W)" + (
    f", years {cls_years[0]}-{cls_years[-1]}" if cls_years else ""
)
write_csv(
    "dq_text",
    ["check", "value"],
    [
        [cls_label, len(bad_cls)],
        ["sprint rows with a position but a non-numeric positionText", len(bad_cls_sp)],
        ["driver names with U+FFFD", bad_driver],
        ["constructor names with U+FFFD", bad_cons],
        ["circuit fields with U+FFFD", bad_circ],
        ["race names with U+FFFD", bad_race],
        ["constructor names with HTML entities (unescaped)", html_ent],
    ],
)
print("done")
