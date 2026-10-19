// New tables: calculated (DAX), M, with their columns and measures.
const R = String.raw;

const dqTables = [
  'Season', 'Circuit', 'Constructor', 'Driver', 'Finishing Status', 'Race', 'Race Results', 'Sprint Results',
  'Qualifying', 'Lap Times', 'Pit Stops', 'Driver Standings', 'Constructor Standings', 'Constructor Results', 'Date'
];
const sel = (col) => `SELECTEDVALUE('${col.table}'[${col.name}])`;
const switchOver = (selector, cases, fallback = 'BLANK()') =>
  `SWITCH(${selector}, ${cases.map(([k, v]) => `"${k}", ${v}`).join(', ')}, ${fallback})`;

const T = 'DQ Tables';
const tsel = "SELECTEDVALUE('DQ Tables'[Check Table])";
const rowsCases = dqTables.map((t) => [t, `COUNTROWS('${t}')`]);
const yr = (t) => `MINX('${t}', RELATED('Race'[Season Year]))`;
const yrMax = (t) => `MAXX('${t}', RELATED('Race'[Season Year]))`;
const raceLinked = ['Race Results', 'Sprint Results', 'Qualifying', 'Lap Times', 'Pit Stops', 'Driver Standings', 'Constructor Standings', 'Constructor Results'];
const firstCases = [['Season', "MIN('Season'[Season])"], ['Race', "MIN('Race'[Season Year])"], ['Date', "YEAR(MIN('Date'[Date]))"], ...raceLinked.map((t) => [t, yr(t)])];
const lastCases = [['Season', "MAX('Season'[Season])"], ['Race', "MAX('Race'[Season Year])"], ['Date', "YEAR(MAX('Date'[Date]))"], ...raceLinked.map((t) => [t, yrMax(t)])];
const dup = (t, cols) => `COUNTROWS('${t}') - COUNTROWS(SUMMARIZE('${t}', ${cols.map((c) => `'${t}'[${c}]`).join(', ')}))`;
const dupCases = [
  ['Season', ['Season']], ['Circuit', ['Circuit Id']], ['Constructor', ['Constructor Id']], ['Driver', ['Driver Id']], ['Finishing Status', ['Status Id']], ['Race', ['Race Id']],
  ['Race Results', ['Race Id', 'Driver Id']], ['Sprint Results', ['Race Id', 'Driver Id']], ['Qualifying', ['Race Id', 'Driver Id']], ['Lap Times', ['Race Id', 'Driver Id', 'Lap Number']],
  ['Pit Stops', ['Race Id', 'Driver Id', 'Stop Number']], ['Driver Standings', ['Race Id', 'Driver Id']], ['Constructor Standings', ['Race Id', 'Constructor Id']], ['Constructor Results', ['Race Id', 'Constructor Id']], ['Date', ['Date']]
].map(([t, c]) => [t, dup(t, c)]);
const miss = (t, rel) => `SUMX('${t}', ${rel.map(([e, c]) => `IF(ISBLANK(RELATED('${e}'[${c}])), 1, 0)`).join(' + ')})`;
const unmatchedCases = [
  ['Race', miss('Race', [['Circuit', 'Circuit Id'], ['Season', 'Season']])],
  ['Race Results', miss('Race Results', [['Race', 'Race Id'], ['Driver', 'Driver Id'], ['Constructor', 'Constructor Id'], ['Finishing Status', 'Status Id']])],
  ['Sprint Results', miss('Sprint Results', [['Race', 'Race Id'], ['Driver', 'Driver Id'], ['Constructor', 'Constructor Id'], ['Finishing Status', 'Status Id']])],
  ['Qualifying', miss('Qualifying', [['Race', 'Race Id'], ['Driver', 'Driver Id'], ['Constructor', 'Constructor Id']])],
  ['Lap Times', miss('Lap Times', [['Race', 'Race Id'], ['Driver', 'Driver Id']])],
  ['Pit Stops', miss('Pit Stops', [['Race', 'Race Id'], ['Driver', 'Driver Id']])],
  ['Driver Standings', miss('Driver Standings', [['Race', 'Race Id'], ['Driver', 'Driver Id']])],
  ['Constructor Standings', miss('Constructor Standings', [['Race', 'Race Id'], ['Constructor', 'Constructor Id']])],
  ['Constructor Results', miss('Constructor Results', [['Race', 'Race Id'], ['Constructor', 'Constructor Id']])]
];
const dqTablesMeasures = [
  { name: 'DQ Rows', fmt: '#,##0', folder: 'Data quality', desc: 'Rows loaded in the model for the table in the row.', expr: switchOver(tsel, rowsCases) },
  { name: 'DQ First Season', fmt: '0', folder: 'Data quality', desc: 'First season with rows for the table, through its race. Blank for lookup tables that are not tied to a season.', expr: switchOver(tsel, firstCases) },
  { name: 'DQ Last Season', fmt: '0', folder: 'Data quality', desc: 'Last season with rows for the table, through its race. Blank for lookup tables that are not tied to a season.', expr: switchOver(tsel, lastCases) },
  { name: 'DQ Duplicate Keys', fmt: '#,##0', folder: 'Data quality', desc: 'Rows beyond the first that share the same natural key (for example race, driver and lap for lap times).', expr: switchOver(tsel, dupCases) },
  { name: 'DQ Unmatched Keys', fmt: '#,##0', folder: 'Data quality', desc: 'Foreign-key values in the table that have no matching row in the table they point to. Lookup tables have no foreign keys and show blank.', expr: switchOver(tsel, unmatchedCases) },
  { name: 'DQ Status', fmt: '@', folder: 'Data quality', desc: 'Fail when the table is empty or has keys without a match, Warn when it has duplicate keys, Pass otherwise.', expr: R`VAR _rows = [DQ Rows]
VAR _unmatched = COALESCE([DQ Unmatched Keys], 0)
VAR _dups = COALESCE([DQ Duplicate Keys], 0)
RETURN IF(ISBLANK(tsel_placeholder), BLANK(), IF(COALESCE(_rows, 0) = 0 || _unmatched > 0, "Fail", IF(_dups > 0, "Warn", "Pass")))`.replace('tsel_placeholder', tsel) },
  { name: 'DQ Pass Count', fmt: '0', folder: 'Data quality', desc: 'Tables whose integrity status is Pass.', expr: `SUMX(ALL('DQ Tables'[Check Table]), IF([DQ Status] = "Pass", 1, 0))` },
  { name: 'DQ Warn Count', fmt: '0', folder: 'Data quality', desc: 'Tables whose integrity status is Warn.', expr: `SUMX(ALL('DQ Tables'[Check Table]), IF([DQ Status] = "Warn", 1, 0))` },
  { name: 'DQ Fail Count', fmt: '0', folder: 'Data quality', desc: 'Tables whose integrity status is Fail.', expr: `SUMX(ALL('DQ Tables'[Check Table]), IF([DQ Status] = "Fail", 1, 0))` }
];

const cols = [
  ['Race Results', 'Grid Position'], ['Race Results', 'Finish Position'], ['Race Results', 'Laps Completed'], ['Race Results', 'Race Duration (ms)'], ['Race Results', 'Fastest Lap Rank'], ['Race Results', 'Fastest Lap Time'],
  ['Sprint Results', 'Grid Position'], ['Sprint Results', 'Finish Position'], ['Qualifying', 'Q1 (ms)'], ['Qualifying', 'Q2 (ms)'], ['Qualifying', 'Q3 (ms)'],
  ['Lap Times', 'Lap Time (ms)'], ['Pit Stops', 'Pit Stop Duration (ms)'], ['Driver', 'Driver Code'], ['Driver', 'Permanent Number'], ['Driver', 'Date of Birth'], ['Circuit', 'Altitude'], ['Race', 'Race Date']
];
const csel = "SELECTEDVALUE('DQ Columns'[Check Column])";
const colKey = (t, c) => `${t}: ${c}`;
const dqColumnsMeasures = [
  { name: 'DQ Column Rows', fmt: '#,##0', folder: 'Data quality', desc: 'Rows in the table that holds the column in the row.', expr: switchOver(csel, cols.map(([t, c]) => [colKey(t, c), `COUNTROWS('${t}')`])) },
  { name: 'DQ Missing Cells', fmt: '#,##0', folder: 'Data quality', desc: 'Rows where the column is blank. The source marks missing values as \\N and they are loaded as blank, never as zero.', expr: switchOver(csel, cols.map(([t, c]) => [colKey(t, c), `COUNTROWS(FILTER('${t}', ISBLANK('${t}'[${c}])))`])) },
  { name: 'DQ Missing Share', fmt: '0.0%', folder: 'Data quality', desc: 'Share of rows where the column is blank.', expr: 'DIVIDE([DQ Missing Cells], [DQ Column Rows])' },
  { name: 'DQ Missing Status', fmt: '@', folder: 'Data quality', desc: 'Pass when under 1% of rows are blank, otherwise Warn. Blank values are mostly coverage gaps by era or entries that did not finish, so this check never fails.', expr: `IF(ISBLANK(${csel}), BLANK(), IF(COALESCE([DQ Missing Share], 0) < 0.01, "Pass", "Warn"))` }
];

const files = [
  ['seasons.csv', "COUNTROWS('Season')"], ['circuits.csv', "COUNTROWS('Circuit')"], ['constructors.csv', "COUNTROWS('Constructor')"], ['drivers.csv', "COUNTROWS('Driver')"], ['status.csv', "COUNTROWS('Finishing Status')"],
  ['races.csv', "COUNTROWS('Race')"], ['results.csv', "COUNTROWS('Race Results')"], ['sprint_results.csv', "COUNTROWS('Sprint Results')"], ['qualifying.csv', "COUNTROWS('Qualifying')"],
  ['lap_times.csv', "COUNTROWS('Lap Times')"], ['pit_stops.csv', "COUNTROWS('Pit Stops')"], ['driver_standings.csv', "COUNTROWS('Driver Standings')"],
  ['constructor_standings.csv', "COUNTROWS('Constructor Standings')"], ['constructor_results.csv', "COUNTROWS('Constructor Results')"]
];
const fsel = "SELECTEDVALUE('DQ Raw Profile'[Source File])";
const rawMeasures = [
  { name: 'DQ Loaded Rows', fmt: '#,##0', folder: 'Data quality', desc: 'Rows of the same source file that were loaded into the model.', expr: switchOver(fsel, files) },
  { name: 'DQ Rows Removed', fmt: '#,##0', folder: 'Data quality', desc: 'Raw rows minus loaded rows. Only duplicate rows are removed in Power Query.', expr: `SUM('DQ Raw Profile'[Raw Rows]) - [DQ Loaded Rows]` },
  { name: 'DQ Profile Status', fmt: '@', folder: 'Data quality', desc: 'Pass when every raw row was loaded, Warn when the rows removed equal the duplicate key rows found (duplicates handled), Fail when rows are missing for any other reason.', expr: R`VAR _removed = [DQ Rows Removed]
VAR _dups = SUM('DQ Raw Profile'[Duplicate Key Rows])
RETURN IF(ISBLANK(_removed), BLANK(), IF(_removed = 0, "Pass", IF(_removed = _dups, "Warn", "Fail")))` }
];

const calc = (name, desc, cols, dax, measures = []) => ({ kind: 'calculated', name, desc, columns: cols.map((c) => ({ name: c })), expr: dax, measures });
module.exports = [
  calc('Compare Driver', 'Disconnected list of drivers for the second driver in head-to-head comparisons. It has no relationship, so it filters nothing by itself.', ['Compare Driver'], "SELECTCOLUMNS('Driver', \"Compare Driver\", 'Driver'[Driver])"),
  calc('Compare Constructor', 'Disconnected list of constructors for the second constructor in head-to-head comparisons. It has no relationship, so it filters nothing by itself.', ['Compare Constructor'], "SELECTCOLUMNS('Constructor', \"Compare Constructor\", 'Constructor'[Constructor])"),
  calc('DQ Tables', 'List of every table loaded in the model, used as the row set for the data-quality checks. Names only; every figure comes from measures.', ['Check Table', 'Table Order'],
    `DATATABLE("Check Table", STRING, "Table Order", INTEGER, {${dqTables.map((t, i) => `{"${t}", ${i + 1}}`).join(', ')}})`, dqTablesMeasures),
  calc('DQ Columns', 'List of columns checked for missing values. Names only; counts come from measures.', ['Check Column', 'Column Table', 'Column Name', 'Column Order'],
    `DATATABLE("Check Column", STRING, "Column Table", STRING, "Column Name", STRING, "Column Order", INTEGER, {${cols.map(([t, c], i) => `{"${colKey(t, c)}", "${t}", "${c}", ${i + 1}}`).join(', ')}})`, dqColumnsMeasures),
  calc('Constructor Families', 'Constructors whose names share a first word, shown as possible renames or successor teams. The source has no lineage field, so these are NOT merged anywhere in the model; this is a derived hint, not a fact.', ['Family', 'Constructor Ids', 'Names'],
    R`VAR _t = ADDCOLUMNS('Constructor', "@Family", LEFT('Constructor'[Constructor], FIND(" ", 'Constructor'[Constructor] & " ") - 1))
VAR _f = DISTINCT(SELECTCOLUMNS(_t, "@Family", [@Family]))
VAR _r = ADDCOLUMNS(_f, "@Ids", VAR _x = [@Family] RETURN COUNTROWS(FILTER(_t, [@Family] = _x)), "@Names", VAR _x = [@Family] RETURN CONCATENATEX(FILTER(_t, [@Family] = _x), [Constructor], ", ", [Constructor], ASC))
RETURN SELECTCOLUMNS(FILTER(_r, [@Ids] > 1 && NOT [@Family] IN {"Team", "Scuderia", "Equipe", "Racing"}), "Family", [@Family], "Constructor Ids", [@Ids], "Names", [@Names])`),
  {
    kind: 'm', name: 'DQ Raw Profile',
    desc: 'Profile of the raw CSV files read directly in Power Query: raw row count, rows sharing the same key, and cells holding the source null marker. Compares the files with what the model loaded.',
    columns: [
      { name: 'Source File', type: 'string', summarize: 'none' },
      { name: 'Raw Rows', type: 'int64', summarize: 'sum', fmt: '#,##0' },
      { name: 'Duplicate Key Rows', type: 'int64', summarize: 'sum', fmt: '#,##0' },
      { name: 'Null Marker Cells', type: 'int64', summarize: 'sum', fmt: '#,##0' }
    ],
    expr: R`let
  Files = {
    {"seasons.csv", {"year"}}, {"circuits.csv", {"circuitId"}}, {"constructors.csv", {"constructorId"}}, {"drivers.csv", {"driverId"}}, {"status.csv", {"statusId"}}, {"races.csv", {"raceId"}}, {"results.csv", {"resultId"}}, {"sprint_results.csv", {"resultId"}}, {"qualifying.csv", {"qualifyId"}}, {"lap_times.csv", {"raceId", "driverId", "lap"}}, {"pit_stops.csv", {"raceId", "driverId", "stop"}}, {"driver_standings.csv", {"driverStandingsId"}}, {"constructor_standings.csv", {"constructorStandingsId"}}, {"constructor_results.csv", {"constructorResultsId"}}
  },
  Profile = (f as list) as record =>
    let
      Raw = Table.PromoteHeaders(Csv.Document(File.Contents(#"F1 CSV Folder" & "\" & f{0}), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]), [PromoteAllScalars=true]),
      Rows = Table.RowCount(Raw),
      Keys = Table.RowCount(Table.Distinct(Table.SelectColumns(Raw, f{1}))),
      Nulls = List.Sum(List.Transform(Table.ColumnNames(Raw), (c) => List.Count(List.Select(Table.Column(Raw, c), (v) => v = "\N"))))
    in
      [#"Source File" = f{0}, #"Raw Rows" = Rows, #"Duplicate Key Rows" = Rows - Keys, #"Null Marker Cells" = Nulls],
  Result = Table.FromRecords(List.Transform(Files, Profile), type table [#"Source File" = text, #"Raw Rows" = Int64.Type, #"Duplicate Key Rows" = Int64.Type, #"Null Marker Cells" = Int64.Type])
in
  Result`,
    measures: rawMeasures
  }
];
