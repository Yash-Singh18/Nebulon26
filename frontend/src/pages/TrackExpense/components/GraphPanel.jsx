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
import "./GraphPanel.css";

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
  const anomalyIds = new Set();
  transactions.forEach((t) => {
    if (Math.abs(Number(t.amount) - mean) > 2 * std) anomalyIds.add(t.id);
  });
  return anomalyIds;
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

function GraphPanel({ transactions }) {
  const [timeRange, setTimeRange] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showIncome, setShowIncome] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [graphTypes, setGraphTypes] = useState(["line"]);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

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
    return txs;
  }, [transactions, start, end, showIncome, showExpense, selectedCategories]);

  const chartData = useMemo(() => bucketData(filtered, start, end), [filtered, start, end]);
  const anomalyIds = useMemo(() => (showAnomalies ? detectAnomalies(filtered) : new Set()), [filtered, showAnomalies]);
  const pieData = useMemo(() => categoryBreakdown(filtered), [filtered]);

  const anomalyPoints = useMemo(() => {
    if (!showAnomalies) return [];
    const points = [];
    filtered.forEach((tx) => {
      if (anomalyIds.has(tx.id)) {
        const d = parseISO(tx.timestamp);
        const bucket = chartData.find((b) =>
          b.label === format(d, chartData.length > 0 ? "MMM dd" : "MMM dd")
        );
        if (bucket) {
          points.push({ ...bucket, anomalyAmount: Number(tx.amount), type: tx.type });
        }
      }
    });
    return points;
  }, [showAnomalies, filtered, anomalyIds, chartData]);

  function toggleGraphType(type) {
    setGraphTypes((prev) =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter((t) => t !== type) : prev) : [...prev, type]
    );
  }

  function toggleCategory(cat) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function downloadCSV() {
    const headers = "amount,type,category,timestamp\n";
    const rows = filtered.map((t) =>
      `${t.amount},${t.type},${t.category || ""},${t.timestamp}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderChart(type, key) {
    const height = graphTypes.length > 1 ? 280 : 360;

    if (type === "pie") {
      return (
        <div className="graph__chart-wrap" key={key}>
          <h4 className="graph__chart-label">Category Breakdown (Pie)</h4>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS.categories[i % COLORS.categories.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (compareMode && type !== "pie") {
      return (
        <div className="graph__compare" key={key}>
          <div className="graph__chart-wrap">
            <h4 className="graph__chart-label">Income ({type})</h4>
            <ResponsiveContainer width="100%" height={height}>
              {type === "bar" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Bar dataKey="income" fill={COLORS.income} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : type === "area" ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="income" stroke={COLORS.income} fill={COLORS.income} fillOpacity={0.2} />
                </AreaChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="income" stroke={COLORS.income} strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="graph__chart-wrap">
            <h4 className="graph__chart-label">Expense ({type})</h4>
            <ResponsiveContainer width="100%" height={height}>
              {type === "bar" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Bar dataKey="expense" fill={COLORS.expense} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : type === "area" ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="expense" stroke={COLORS.expense} fill={COLORS.expense} fillOpacity={0.2} />
                </AreaChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="expense" stroke={COLORS.expense} strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    const tooltipStyle = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 };
    const xProps = { dataKey: "label", tick: { fill: "var(--color-text-secondary)", fontSize: 12 } };
    const yProps = { tick: { fill: "var(--color-text-secondary)", fontSize: 12 } };
    const gridProps = { strokeDasharray: "3 3", stroke: "var(--color-border)" };

    return (
      <div className="graph__chart-wrap" key={key}>
        <h4 className="graph__chart-label">{type.charAt(0).toUpperCase() + type.slice(1)} Chart</h4>
        <ResponsiveContainer width="100%" height={height}>
          {type === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xProps} />
              <YAxis {...yProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              {showIncome && <Bar dataKey="income" fill={COLORS.income} radius={[4, 4, 0, 0]} />}
              {showExpense && <Bar dataKey="expense" fill={COLORS.expense} radius={[4, 4, 0, 0]} />}
            </BarChart>
          ) : type === "area" ? (
            <AreaChart data={chartData}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xProps} />
              <YAxis {...yProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              {showIncome && <Area type="monotone" dataKey="income" stroke={COLORS.income} fill={COLORS.income} fillOpacity={0.15} />}
              {showExpense && <Area type="monotone" dataKey="expense" stroke={COLORS.expense} fill={COLORS.expense} fillOpacity={0.15} />}
            </AreaChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xProps} />
              <YAxis {...yProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              {showIncome && <Line type="monotone" dataKey="income" stroke={COLORS.income} strokeWidth={2} dot={false} />}
              {showExpense && <Line type="monotone" dataKey="expense" stroke={COLORS.expense} strokeWidth={2} dot={false} />}
              {showAnomalies && anomalyPoints.map((p, i) => (
                <ReferenceDot key={i} x={p.label} y={p[p.type]} r={6}
                  fill="#F59E0B" stroke="#F59E0B" strokeWidth={2}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="graph">
      {/* Controls */}
      <div className="graph__controls">
        <div className="graph__control-group">
          <span className="graph__control-label">Time Range</span>
          <div className="graph__pills">
            {TIME_RANGES.map((r) => (
              <button key={r.key}
                className={`graph__pill${timeRange === r.key ? " graph__pill--active" : ""}`}
                onClick={() => setTimeRange(r.key)}
              >{r.label}</button>
            ))}
          </div>
          {timeRange === "custom" && (
            <div className="graph__custom-range">
              <input type="date" className="graph__date-input" value={customStart}
                onChange={(e) => setCustomStart(e.target.value)} />
              <span>to</span>
              <input type="date" className="graph__date-input" value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}
        </div>

        <div className="graph__control-group">
          <span className="graph__control-label">Graph Type</span>
          <div className="graph__pills">
            {GRAPH_TYPES.map((g) => (
              <button key={g.key}
                className={`graph__pill${graphTypes.includes(g.key) ? " graph__pill--active" : ""}`}
                onClick={() => toggleGraphType(g.key)}
              >{g.label}</button>
            ))}
          </div>
        </div>

        <div className="graph__control-group">
          <span className="graph__control-label">Show</span>
          <div className="graph__checks">
            <label className="graph__check">
              <input type="checkbox" checked={showIncome}
                onChange={(e) => setShowIncome(e.target.checked)} />
              <span style={{ color: COLORS.income }}>Income</span>
            </label>
            <label className="graph__check">
              <input type="checkbox" checked={showExpense}
                onChange={(e) => setShowExpense(e.target.checked)} />
              <span style={{ color: COLORS.expense }}>Expense</span>
            </label>
          </div>
        </div>

        <div className="graph__control-group">
          <span className="graph__control-label">Options</span>
          <div className="graph__checks">
            <label className="graph__check">
              <input type="checkbox" checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)} />
              <span>Compare Split</span>
            </label>
            <label className="graph__check">
              <input type="checkbox" checked={showAnomalies}
                onChange={(e) => setShowAnomalies(e.target.checked)} />
              <span>Flag Anomalies</span>
            </label>
          </div>
        </div>

        {allCategories.length > 0 && (
          <div className="graph__control-group">
            <span className="graph__control-label">
              Categories {selectedCategories.length > 0 && (
                <button className="graph__clear-cats" onClick={() => setSelectedCategories([])}>Clear</button>
              )}
            </span>
            <div className="graph__checks graph__checks--wrap">
              {allCategories.map((cat) => (
                <label className="graph__check" key={cat}>
                  <input type="checkbox" checked={selectedCategories.includes(cat)}
                    onChange={() => toggleCategory(cat)} />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button className="graph__download" onClick={downloadCSV}>
          ⬇ Download CSV
        </button>
      </div>

      {/* Charts grid */}
      <div className={`graph__grid graph__grid--${graphTypes.length > 1 ? "multi" : "single"}`}>
        {chartData.length === 0 ? (
          <div className="graph__empty">No data for the selected range and filters.</div>
        ) : (
          graphTypes.map((type) => renderChart(type, type))
        )}
      </div>

      {/* Anomaly list */}
      {showAnomalies && anomalyIds.size > 0 && (
        <div className="graph__anomalies">
          <h4>Flagged Anomalies ({anomalyIds.size})</h4>
          <div className="graph__anomaly-list">
            {filtered.filter((t) => anomalyIds.has(t.id)).map((t) => (
              <div key={t.id} className="graph__anomaly-item">
                <span className="graph__anomaly-badge">{t.type}</span>
                <span>₹{Number(t.amount).toLocaleString()}</span>
                <span className="graph__anomaly-cat">{t.category || "N/A"}</span>
                <span className="graph__anomaly-date">{format(parseISO(t.timestamp), "MMM dd, yyyy")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GraphPanel;
