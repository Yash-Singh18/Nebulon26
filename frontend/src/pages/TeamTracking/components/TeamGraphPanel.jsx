import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import {
  subHours, subDays, subMonths, subYears, startOfDay, endOfDay,
  format, parseISO, isWithinInterval,
} from "date-fns";
import "./TeamGraphPanel.css";

const TIME_RANGES = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "6mo", label: "6 Months" },
  { key: "1y", label: "1 Year" },
  { key: "custom", label: "Custom" },
];

const GRAPH_TYPES = [
  { key: "line", label: "Line" },
  { key: "bar", label: "Bar" },
  { key: "area", label: "Area" },
  { key: "pie", label: "Pie" },
];

const COLORS = {
  income: "#22C55E",
  expense: "#EF4444",
  net: "#3B82F6",
  categories: ["#3B82F6", "#22C55E", "#F59E0B", "#A855F7", "#EF4444", "#06B6D4", "#EC4899", "#F97316"],
};

function getDateRange(rangeKey, customStart, customEnd) {
  const now = new Date();
  switch (rangeKey) {
    case "24h": return { start: subHours(now, 24), end: now };
    case "7d": return { start: subDays(now, 7), end: now };
    case "30d": return { start: subDays(now, 30), end: now };
    case "6mo": return { start: subMonths(now, 6), end: now };
    case "1y": return { start: subYears(now, 1), end: now };
    case "custom":
      return {
        start: customStart ? startOfDay(new Date(customStart)) : subDays(now, 30),
        end: customEnd ? endOfDay(new Date(customEnd)) : now,
      };
    default: return { start: subDays(now, 30), end: now };
  }
}

function bucketData(transactions, start, end) {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  let bucketFormat, labelFormat;
  if (diffDays <= 1) { bucketFormat = "yyyy-MM-dd HH"; labelFormat = "HH:00"; }
  else if (diffDays <= 31) { bucketFormat = "yyyy-MM-dd"; labelFormat = "MMM dd"; }
  else if (diffDays <= 180) { bucketFormat = "yyyy-'W'II"; labelFormat = "'W'II"; }
  else { bucketFormat = "yyyy-MM"; labelFormat = "MMM yyyy"; }

  const buckets = {};
  for (const tx of transactions) {
    const d = parseISO(tx.timestamp);
    if (!isWithinInterval(d, { start, end })) continue;
    const key = format(d, bucketFormat);
    if (!buckets[key]) buckets[key] = { key, label: format(d, labelFormat), income: 0, expense: 0 };
    buckets[key][tx.type] += Number(tx.amount);
  }

  return Object.values(buckets)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key: _k, ...b }) => ({ ...b, net: b.income - b.expense }));
}

function detectAnomalies(transactions) {
  const amounts = transactions.map((t) => Number(t.amount));
  if (amounts.length < 4) return new Set();
  const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  const std = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
  if (std === 0) return new Set();
  const ids = new Set();
  transactions.forEach((t) => {
    if (Math.abs(Number(t.amount) - mean) > 2 * std) ids.add(t.id);
  });
  return ids;
}

function categoryBreakdown(transactions) {
  const cats = {};
  for (const tx of transactions) {
    const cat = tx.category || "Uncategorized";
    if (!cats[cat]) cats[cat] = 0;
    cats[cat] += Number(tx.amount);
  }
  return Object.entries(cats).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
}

function departmentBreakdown(transactions, memberMap) {
  const depts = {};
  for (const tx of transactions) {
    const member = memberMap[tx.added_by];
    const dept = member?.department || "No Department";
    if (!depts[dept]) depts[dept] = 0;
    depts[dept] += Number(tx.amount);
  }
  return Object.entries(depts).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
}

function TeamGraphPanel({ transactions, members = [] }) {
  const [timeRange, setTimeRange] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showIncome, setShowIncome] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [graphTypes, setGraphTypes] = useState(["line"]);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  // Build member lookup
  const memberMap = useMemo(() => {
    const map = {};
    for (const m of members) {
      map[m.user_id] = m;
    }
    return map;
  }, [members]);

  const allDepts = useMemo(() => {
    const set = new Set();
    members.forEach((m) => { if (m.department) set.add(m.department); });
    return [...set].sort();
  }, [members]);

  const allCategories = useMemo(() => {
    const set = new Set();
    transactions.forEach((t) => { if (t.category) set.add(t.category); });
    return [...set].sort();
  }, [transactions]);

  const { start, end } = useMemo(
    () => getDateRange(timeRange, customStart, customEnd),
    [timeRange, customStart, customEnd]
  );

  const filtered = useMemo(() => {
    let txs = transactions.filter((t) => {
      const d = parseISO(t.timestamp);
      return isWithinInterval(d, { start, end });
    });
    if (!showIncome) txs = txs.filter((t) => t.type !== "income");
    if (!showExpense) txs = txs.filter((t) => t.type !== "expense");
    if (selectedCategories.length > 0) {
      txs = txs.filter((t) => selectedCategories.includes(t.category || "Uncategorized"));
    }
    if (selectedDepts.length > 0) {
      txs = txs.filter((t) => {
        const member = memberMap[t.added_by];
        const dept = member?.department || "No Department";
        return selectedDepts.includes(dept);
      });
    }
    return txs;
  }, [transactions, start, end, showIncome, showExpense, selectedCategories, selectedDepts, memberMap]);

  const chartData = useMemo(() => bucketData(filtered, start, end), [filtered, start, end]);
  const anomalyIds = useMemo(() => (showAnomalies ? detectAnomalies(filtered) : new Set()), [filtered, showAnomalies]);
  const pieData = useMemo(() => categoryBreakdown(filtered), [filtered]);
  const deptPieData = useMemo(() => departmentBreakdown(filtered, memberMap), [filtered, memberMap]);

  function toggleGraphType(type) {
    setGraphTypes((prev) =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter((t) => t !== type) : prev) : [...prev, type]
    );
  }

  function toggleDept(dept) {
    setSelectedDepts((prev) => prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]);
  }

  function toggleCategory(cat) {
    setSelectedCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  }

  function downloadCSV() {
    const headers = "amount,type,category,timestamp,added_by\n";
    const rows = filtered.map((t) => {
      const member = memberMap[t.added_by];
      const user = member?.profiles?.username || member?.profiles?.name || "";
      return `${t.amount},${t.type},${t.category || ""},${t.timestamp},${user}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team_transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const tooltipStyle = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 };
  const xProps = { dataKey: "label", tick: { fill: "var(--color-text-secondary)", fontSize: 12 } };
  const yProps = { tick: { fill: "var(--color-text-secondary)", fontSize: 12 } };
  const gridProps = { strokeDasharray: "3 3", stroke: "var(--color-border)" };

  function renderChart(type, key) {
    const height = graphTypes.length > 1 ? 280 : 360;

    if (type === "pie") {
      const data = deptPieData.length > 1 ? deptPieData : pieData;
      const label = deptPieData.length > 1 ? "Department Breakdown" : "Category Breakdown";
      return (
        <div className="tgraph__chart-wrap" key={key}>
          <h4 className="tgraph__chart-label">{label} (Pie)</h4>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
                outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS.categories[i % COLORS.categories.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `\u20B9${v.toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (compareMode) {
      return (
        <div className="tgraph__compare" key={key}>
          <div className="tgraph__chart-wrap">
            <h4 className="tgraph__chart-label">Income ({type})</h4>
            <ResponsiveContainer width="100%" height={height}>
              {type === "bar" ? (
                <BarChart data={chartData}><CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="income" fill={COLORS.income} radius={[4, 4, 0, 0]} /></BarChart>
              ) : type === "area" ? (
                <AreaChart data={chartData}><CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="income" stroke={COLORS.income} fill={COLORS.income} fillOpacity={0.2} /></AreaChart>
              ) : (
                <LineChart data={chartData}><CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="income" stroke={COLORS.income} strokeWidth={2} dot={false} /></LineChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="tgraph__chart-wrap">
            <h4 className="tgraph__chart-label">Expense ({type})</h4>
            <ResponsiveContainer width="100%" height={height}>
              {type === "bar" ? (
                <BarChart data={chartData}><CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="expense" fill={COLORS.expense} radius={[4, 4, 0, 0]} /></BarChart>
              ) : type === "area" ? (
                <AreaChart data={chartData}><CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="expense" stroke={COLORS.expense} fill={COLORS.expense} fillOpacity={0.2} /></AreaChart>
              ) : (
                <LineChart data={chartData}><CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="expense" stroke={COLORS.expense} strokeWidth={2} dot={false} /></LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return (
      <div className="tgraph__chart-wrap" key={key}>
        <h4 className="tgraph__chart-label">{type.charAt(0).toUpperCase() + type.slice(1)} Chart</h4>
        <ResponsiveContainer width="100%" height={height}>
          {type === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} />
              <Tooltip contentStyle={tooltipStyle} /><Legend />
              {showIncome && <Bar dataKey="income" fill={COLORS.income} radius={[4, 4, 0, 0]} />}
              {showExpense && <Bar dataKey="expense" fill={COLORS.expense} radius={[4, 4, 0, 0]} />}
            </BarChart>
          ) : type === "area" ? (
            <AreaChart data={chartData}>
              <CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} />
              <Tooltip contentStyle={tooltipStyle} /><Legend />
              {showIncome && <Area type="monotone" dataKey="income" stroke={COLORS.income} fill={COLORS.income} fillOpacity={0.15} />}
              {showExpense && <Area type="monotone" dataKey="expense" stroke={COLORS.expense} fill={COLORS.expense} fillOpacity={0.15} />}
            </AreaChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} />
              <Tooltip contentStyle={tooltipStyle} /><Legend />
              {showIncome && <Line type="monotone" dataKey="income" stroke={COLORS.income} strokeWidth={2} dot={false} />}
              {showExpense && <Line type="monotone" dataKey="expense" stroke={COLORS.expense} strokeWidth={2} dot={false} />}
              {showAnomalies && filtered.filter((t) => anomalyIds.has(t.id)).map((t, i) => {
                const d = parseISO(t.timestamp);
                const bucket = chartData.find((b) => b.label === format(d, "MMM dd"));
                return bucket ? <ReferenceDot key={i} x={bucket.label} y={bucket[t.type]} r={6} fill="#F59E0B" stroke="#F59E0B" strokeWidth={2} /> : null;
              })}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="tgraph">
      {/* Controls */}
      <div className="tgraph__controls">
        <div className="tgraph__control-group">
          <span className="tgraph__control-label">Time Range</span>
          <div className="tgraph__pills">
            {TIME_RANGES.map((r) => (
              <button key={r.key}
                className={`tgraph__pill${timeRange === r.key ? " tgraph__pill--active" : ""}`}
                onClick={() => setTimeRange(r.key)}
              >{r.label}</button>
            ))}
          </div>
          {timeRange === "custom" && (
            <div className="tgraph__custom-range">
              <input type="date" className="tgraph__date-input" value={customStart}
                onChange={(e) => setCustomStart(e.target.value)} />
              <span>to</span>
              <input type="date" className="tgraph__date-input" value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}
        </div>

        <div className="tgraph__control-group">
          <span className="tgraph__control-label">Graph Type</span>
          <div className="tgraph__pills">
            {GRAPH_TYPES.map((g) => (
              <button key={g.key}
                className={`tgraph__pill${graphTypes.includes(g.key) ? " tgraph__pill--active" : ""}`}
                onClick={() => toggleGraphType(g.key)}
              >{g.label}</button>
            ))}
          </div>
        </div>

        <div className="tgraph__control-group">
          <span className="tgraph__control-label">Show</span>
          <div className="tgraph__checks">
            <label className="tgraph__check">
              <input type="checkbox" checked={showIncome} onChange={(e) => setShowIncome(e.target.checked)} />
              <span style={{ color: COLORS.income }}>Income</span>
            </label>
            <label className="tgraph__check">
              <input type="checkbox" checked={showExpense} onChange={(e) => setShowExpense(e.target.checked)} />
              <span style={{ color: COLORS.expense }}>Expense</span>
            </label>
          </div>
        </div>

        <div className="tgraph__control-group">
          <span className="tgraph__control-label">Options</span>
          <div className="tgraph__checks">
            <label className="tgraph__check">
              <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} />
              <span>Compare Split</span>
            </label>
            <label className="tgraph__check">
              <input type="checkbox" checked={showAnomalies} onChange={(e) => setShowAnomalies(e.target.checked)} />
              <span>Flag Anomalies</span>
            </label>
          </div>
        </div>

        {allDepts.length > 0 && (
          <div className="tgraph__control-group">
            <span className="tgraph__control-label">
              Departments {selectedDepts.length > 0 && (
                <button className="tgraph__clear-filter" onClick={() => setSelectedDepts([])}>Clear</button>
              )}
            </span>
            <div className="tgraph__checks tgraph__checks--wrap">
              {allDepts.map((dept) => (
                <label className="tgraph__check" key={dept}>
                  <input type="checkbox" checked={selectedDepts.includes(dept)} onChange={() => toggleDept(dept)} />
                  <span>{dept}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {allCategories.length > 0 && (
          <div className="tgraph__control-group">
            <span className="tgraph__control-label">
              Categories {selectedCategories.length > 0 && (
                <button className="tgraph__clear-filter" onClick={() => setSelectedCategories([])}>Clear</button>
              )}
            </span>
            <div className="tgraph__checks tgraph__checks--wrap">
              {allCategories.map((cat) => (
                <label className="tgraph__check" key={cat}>
                  <input type="checkbox" checked={selectedCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button className="tgraph__download" onClick={downloadCSV}>
          Download CSV
        </button>
      </div>

      {/* Charts */}
      <div className={`tgraph__grid tgraph__grid--${graphTypes.length > 1 ? "multi" : "single"}`}>
        {chartData.length === 0 ? (
          <div className="tgraph__empty">No data for the selected range and filters.</div>
        ) : (
          graphTypes.map((type) => renderChart(type, type))
        )}
      </div>

      {/* Anomalies */}
      {showAnomalies && anomalyIds.size > 0 && (
        <div className="tgraph__anomalies">
          <h4>Flagged Anomalies ({anomalyIds.size})</h4>
          <div className="tgraph__anomaly-list">
            {filtered.filter((t) => anomalyIds.has(t.id)).map((t) => (
              <div key={t.id} className="tgraph__anomaly-item">
                <span className="tgraph__anomaly-badge">{t.type}</span>
                <span>{"\u20B9"}{Number(t.amount).toLocaleString()}</span>
                <span className="tgraph__anomaly-cat">{t.category || "N/A"}</span>
                <span className="tgraph__anomaly-user">
                  by {memberMap[t.added_by]?.profiles?.username ? `@${memberMap[t.added_by].profiles.username}` : memberMap[t.added_by]?.profiles?.name || "Unknown"}
                </span>
                <span className="tgraph__anomaly-date">{format(parseISO(t.timestamp), "MMM dd, yyyy")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamGraphPanel;
