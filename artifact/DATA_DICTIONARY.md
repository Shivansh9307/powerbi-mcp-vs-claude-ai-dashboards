# F1 Evolution — data dictionary & traceability

Rebuild: `python prep_data.py <raw_csv_dir> data` → 17 CSVs in `data/` (these are the dashboard's datasets).
In the dashboard, every number is computed in the browser from these tables (`src/core.js` = relations, filters, metrics).
`\N` in the source becomes an **empty cell** = missing (never 0).

## Datasets (grain → source)
| Dataset | Grain | Columns | Source / transformation |
|---|---|---|---|
| dim_drivers | driver | id, name, code, nat, dob | drivers.csv; forename+surname, HTML unescaped |
| dim_constructors | constructor ID | id, name, nat | constructors.csv (IDs **not** merged across renames) |
| dim_circuits | circuit | id, name, loc, country, lat, lng | circuits.csv |
| dim_status | statusId | id, status, group | status.csv + grouping rule below |
| fact_races | race | id, year, round, name, date, circuit, done, entries, starters, wpts, spts, sprint, nq, nlap, npit, lapmed, lapbest, laps | races.csv + counts from results / sprints / qualifying / lap_times / pit_stops. `done`=has results. `wpts`=sum of points of rows with classified position 1; `spts` same for the sprint |
| fact_results | car entry (race×driver×constructor) | r,d,c, g=grid, p=position (classified), o=positionOrder, pt=points, l=laps, s=status group, si=statusId, fr=fastest-lap rank | results.csv |
| fact_sprints | sprint entry | r,d,c,g,p,o,pt,l,s | sprint_results.csv |
| fact_quali | race×driver | r,d,c,p,q1,q2,q3 (ms) | qualifying.csv, lap strings → ms |
| fact_pits | stop | r,d,stop,lap,ms | pit_stops.csv |
| fact_laps | race×driver | r,d,n,best,med,mean,led (ms; led=laps in P1) | lap_times.csv aggregated; 1,979 duplicate lap rows dropped (first kept) |
| std_drivers / std_constructors | standings snapshot after each race | r,d|c,pt,po,w | driver_standings / constructor_standings |
| dq_* | raw-file profile | tables, nulls, FKs, coverage, text checks | computed from the raw files in the prep step |

## Status groups (`s`)
Priority: positionText `F`/`W` → **6 Did not start** (did-not-qualify/prequalify, 107% rule, withdrawn); `D`/`E` or statusId {2,92,96} → **4 Disqualified**; statusId 1 → **0 Finished**; "+N Lap(s)" → **1 Lapped**; Accident, Collision, Spun off, Collision damage, Damage, Debris, Fatal accident → **3 Accident DNF**; Retired, Not classified, Withdrew, Injured/Injury, Driver unwell, Eye injury, Illness, Physical, Safety, Safety concerns, Not restarted → **5 Other DNF**; everything else (engine, gearbox, hydraulics …) → **2 Mechanical DNF**.

## Metrics
- **Entry** = result row. **Start** = entry with group ≠ 6. **Race** = distinct raceId among starts (shared drives count once).
- **Wins** = starts with `p = 1` (Grand Prix only; 3 shared-win races give 2 credits). **Podiums** `p ≤ 3`. **Classified finishes** `p` not empty. `p` is derived from **positionText** (digits = classified): the raw `position` column is also filled for retired / disqualified / withdrawn rows in 2025–2026 (153 result + sprint rows), which would otherwise show ~100% classified finishers.
- **Poles** = starts with `g = 1` (race grid; `g = 0` is "pit lane / unrecorded", empty is missing — neither is a pole).
- Win % / Podium % / Pole rate = ÷ starts. **Pole→win** = wins from `g=1` ÷ poles.
- **DNF rate** = (group 2 + 3 + 5) ÷ starts; Mechanical = group 2; Accident = group 3.
- **Avg finish** = mean `p` over classified starts. **Avg grid** = mean `g` over starts with `g ≥ 1`. **Positions gained** = mean(`g − p`) over classified starts with `g ≥ 1`.
- **Recorded points** = Σ race `pt` + Σ sprint `pt` in each season's own scoring system. **Official points** = final standings.
- **Era-normalised points** = recorded points ÷ Σ over starts of (race winner's points + sprint winner's points of that race).
- **Dominance Index** (driver-season) = (wins ÷ races) × (driver points ÷ all points scored that season).
- **Titles** = `po = 1` in the standings snapshot after the last race with results, **completed seasons only** (held = scheduled). Driver's car for constructor attribution = constructor with most starts that season.
- **Head-to-head** = races both started; ahead = lower `o`.
- **Pit stops**: `duration` = time in the pit lane, entry to exit (typical 15–30 s) — NOT the stationary tyre-change time, which this dataset does not contain. Typical ≤ 60 s; longer reported as extended; the fastest-stops table shows each value's gap to its race median to expose outliers. **Qualifying gap** = driver's best of Q1–Q3 ÷ session-fastest − 1.

## Treatments / limits
- Constructor renames are not merged (no lineage field in source).
- 2026 is partial (17 of 23 races with results at build time); flagged and excluded from titles.
- Lap times 1982–2026, pit stops 1994–2026, qualifying 1994–2026 (partial early), sprints 2021–2026, constructor standings 1958–2026 — as present in this dataset.
