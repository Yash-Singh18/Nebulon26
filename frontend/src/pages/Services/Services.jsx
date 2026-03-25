import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { getSession, signInWithGoogle, signOut } from "../../services/supabase/auth";
import { getProfile } from "../../services/supabase/profiles";
import { getBusinesses } from "../../services/supabase/businesses";
import { getTransactions } from "../../services/supabase/transactions";
import Navbar from "../../components/Navbar/Navbar";
import "./Services.css";

// ── Formatters ────────────────────────────────────────────────────────────

function fmtINR(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Stats computation ─────────────────────────────────────────────────────

function computeStats(transactions) {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const catMap = {};
  transactions.forEach((t) => {
    const cat = t.category || "Uncategorized";
    if (!catMap[cat]) catMap[cat] = { income: 0, expense: 0 };
    if (t.type === "income") catMap[cat].income += Number(t.amount);
    else catMap[cat].expense += Number(t.amount);
  });
  const topCategories = Object.entries(catMap)
    .map(([name, v]) => ({ name, total: v.income + v.expense, income: v.income, expense: v.expense }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const monthMap = {};
  transactions.forEach((t) => {
    const d = new Date(t.timestamp || t.created_at || Date.now());
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    if (!monthMap[key]) monthMap[key] = { income: 0, expense: 0, label };
    if (t.type === "income") monthMap[key].income += Number(t.amount);
    else monthMap[key].expense += Number(t.amount);
  });
  const months = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([, v]) => v);

  const largestIncome = transactions
    .filter((t) => t.type === "income")
    .sort((a, b) => b.amount - a.amount)[0];
  const largestExpense = transactions
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)[0];

  return {
    income,
    expense,
    net: income - expense,
    count: transactions.length,
    topCategories,
    months,
    largestIncome,
    largestExpense,
    margin: income > 0 ? (((income - expense) / income) * 100).toFixed(1) : 0,
  };
}

// ── Print helpers ─────────────────────────────────────────────────────────

function printHTML(html) {
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

function buildReportHTML(bizName, bizType, stats, generatedAt) {
  const profitColor = stats.net >= 0 ? "#16A34A" : "#DC2626";
  const profitLabel = stats.net >= 0 ? "Net Profit" : "Net Loss";

  const catRows = stats.topCategories
    .map(
      (c) => `
    <tr>
      <td>${c.name}</td>
      <td style="color:#16A34A">${fmtINR(c.income)}</td>
      <td style="color:#DC2626">${fmtINR(c.expense)}</td>
      <td style="font-weight:700">${fmtINR(c.total)}</td>
    </tr>`
    )
    .join("");

  const monthRows = stats.months
    .map(
      (m) => `
    <tr>
      <td style="font-weight:600">${m.label}</td>
      <td style="color:#16A34A">${fmtINR(m.income)}</td>
      <td style="color:#DC2626">${fmtINR(m.expense)}</td>
      <td style="color:${m.income - m.expense >= 0 ? "#16A34A" : "#DC2626"};font-weight:700">${fmtINR(m.income - m.expense)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Business Report — ${bizName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111827; padding: 40px 48px; font-size: 13px; }
  .rpt-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #3B82F6; padding-bottom: 20px; margin-bottom: 28px; }
  .rpt-brand { display: flex; align-items: center; gap: 10px; }
  .rpt-brand-icon { font-size: 28px; color: #3B82F6; }
  .rpt-brand-name { font-size: 22px; font-weight: 800; color: #1E3A5F; letter-spacing: -0.5px; }
  .rpt-meta { text-align: right; }
  .rpt-title { font-size: 20px; font-weight: 800; color: #1E3A5F; }
  .rpt-sub { font-size: 12px; color: #6B7280; margin-top: 4px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
  .kpi { border: 1px solid #E5E7EB; border-radius: 10px; padding: 16px 18px; background: #F9FAFB; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: #6B7280; margin-bottom: 8px; }
  .kpi-value { font-size: 22px; font-weight: 800; }
  .kpi-note { font-size: 10px; color: #9CA3AF; margin-top: 4px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 14px; font-weight: 800; color: #1E3A5F; border-left: 4px solid #3B82F6; padding-left: 10px; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #EFF6FF; color: #1D4ED8; font-weight: 700; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 9px 12px; border-bottom: 1px solid #F3F4F6; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; color: #9CA3AF; font-size: 11px; }
  .highlight-green { color: #16A34A; }
  .highlight-red { color: #DC2626; }
  @media print { body { padding: 24px; } @page { margin: 16mm; } }
</style>
</head>
<body>
  <div class="rpt-header">
    <div class="rpt-brand">
      <span class="rpt-brand-icon">◈</span>
      <span class="rpt-brand-name">SIRIUS</span>
    </div>
    <div class="rpt-meta">
      <div class="rpt-title">${bizName}${bizType ? ` · ${bizType}` : ""}</div>
      <div class="rpt-sub">Business Financial Report &nbsp;|&nbsp; Generated ${generatedAt}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Total Income</div>
      <div class="kpi-value highlight-green">${fmtINR(stats.income)}</div>
      <div class="kpi-note">${stats.count} transactions</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total Expenses</div>
      <div class="kpi-value highlight-red">${fmtINR(stats.expense)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">${profitLabel}</div>
      <div class="kpi-value" style="color:${profitColor}">${fmtINR(Math.abs(stats.net))}</div>
      <div class="kpi-note">Margin: ${stats.margin}%</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Transaction Count</div>
      <div class="kpi-value" style="color:#3B82F6">${stats.count}</div>
      <div class="kpi-note">Avg: ${fmtINR(stats.count > 0 ? (stats.income + stats.expense) / stats.count : 0)}</div>
    </div>
  </div>

  ${
    stats.months.length > 0
      ? `<div class="section">
    <div class="section-title">Monthly Breakdown</div>
    <table>
      <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead>
      <tbody>${monthRows}</tbody>
    </table>
  </div>`
      : ""
  }

  ${
    stats.topCategories.length > 0
      ? `<div class="section">
    <div class="section-title">Category Analysis</div>
    <table>
      <thead><tr><th>Category</th><th>Income</th><th>Expenses</th><th>Total Activity</th></tr></thead>
      <tbody>${catRows}</tbody>
    </table>
  </div>`
      : ""
  }

  <div class="footer">
    <span>◈ SIRIUS — AI Financial Copilot for SMEs</span>
    <span>Confidential · ${generatedAt}</span>
  </div>
</body>
</html>`;
}

function buildBillHTML(b) {
  const subtotal = b.items.reduce((s, it) => s + Number(it.qty) * Number(it.rate), 0);
  const gstAmt = (subtotal * b.gstRate) / 100;
  const total = subtotal + gstAmt;

  const itemRows = b.items
    .filter((it) => it.description.trim())
    .map(
      (it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.description}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${fmtINR(it.rate)}</td>
      <td style="text-align:right;font-weight:600">${fmtINR(Number(it.qty) * Number(it.rate))}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Invoice #${b.billNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; background: #fff; padding: 48px; font-size: 13px; }
  .inv-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
  .inv-brand { display: flex; flex-direction: column; gap: 4px; }
  .inv-brand-row { display: flex; align-items: center; gap: 8px; }
  .inv-brand-icon { font-size: 24px; color: #3B82F6; }
  .inv-brand-name { font-size: 20px; font-weight: 800; color: #1E3A5F; }
  .inv-seller-name { font-size: 18px; font-weight: 800; color: #111827; margin-top: 8px; }
  .inv-seller-meta { font-size: 12px; color: #6B7280; line-height: 1.7; margin-top: 4px; }
  .inv-title-block { text-align: right; }
  .inv-title { font-size: 32px; font-weight: 900; color: #3B82F6; letter-spacing: -1px; }
  .inv-meta { font-size: 12px; color: #6B7280; margin-top: 8px; line-height: 1.8; }
  .inv-meta strong { color: #111827; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; background: #F0F7FF; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; }
  .party-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #3B82F6; margin-bottom: 8px; }
  .party-name { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .party-detail { font-size: 12px; color: #6B7280; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  .items-table th { background: #1E3A5F; color: #fff; padding: 11px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .items-table th:last-child { text-align: right; }
  .items-table th:nth-child(3) { text-align: center; }
  .items-table th:nth-child(4) { text-align: right; }
  .items-table td { padding: 10px 14px; border-bottom: 1px solid #F3F4F6; }
  .items-table tr:last-child td { border-bottom: none; }
  .items-table tr:nth-child(even) td { background: #FAFAFA; }
  .totals { margin-left: auto; width: 280px; margin-top: 4px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 13px; }
  .totals-row.subtotal { border-top: 1px solid #E5E7EB; color: #4B5563; }
  .totals-row.tax { color: #4B5563; }
  .totals-row.total { background: #1E3A5F; color: #fff; font-size: 16px; font-weight: 800; border-radius: 8px; margin-top: 4px; }
  .inv-footer { margin-top: 36px; display: flex; justify-content: space-between; align-items: flex-end; }
  .inv-notes { max-width: 400px; }
  .inv-notes-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #9CA3AF; margin-bottom: 6px; }
  .inv-notes-text { font-size: 12px; color: #6B7280; line-height: 1.6; }
  .inv-sign { text-align: right; }
  .inv-sign-line { width: 180px; border-top: 1px solid #111827; margin-bottom: 6px; }
  .inv-sign-label { font-size: 11px; color: #6B7280; }
  .inv-copy { margin-top: 32px; padding-top: 14px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 11px; color: #9CA3AF; }
  @media print { body { padding: 24px; } @page { margin: 12mm; } }
</style>
</head>
<body>
  <div class="inv-top">
    <div class="inv-brand">
      <div class="inv-brand-row">
        <span class="inv-brand-icon">◈</span>
        <span class="inv-brand-name">SIRIUS</span>
      </div>
      <div class="inv-seller-name">${b.seller.name || "Your Business"}</div>
      <div class="inv-seller-meta">
        ${b.seller.address ? b.seller.address + "<br/>" : ""}
        ${b.seller.phone ? "Tel: " + b.seller.phone + "<br/>" : ""}
        ${b.seller.gstin ? "GSTIN: " + b.seller.gstin : ""}
      </div>
    </div>
    <div class="inv-title-block">
      <div class="inv-title">INVOICE</div>
      <div class="inv-meta">
        <strong>Invoice No:</strong> ${b.billNo}<br/>
        <strong>Date:</strong> ${fmtDate(b.date)}
      </div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">From</div>
      <div class="party-name">${b.seller.name || "—"}</div>
      <div class="party-detail">
        ${b.seller.address || ""}${b.seller.phone ? "<br/>Tel: " + b.seller.phone : ""}
        ${b.seller.gstin ? "<br/>GSTIN: " + b.seller.gstin : ""}
      </div>
    </div>
    <div>
      <div class="party-label">Bill To</div>
      <div class="party-name">${b.buyer.name || "—"}</div>
      <div class="party-detail">
        ${b.buyer.address || ""}${b.buyer.phone ? "<br/>Tel: " + b.buyer.phone : ""}
      </div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Description</th>
        <th style="width:70px;text-align:center">Qty</th>
        <th style="width:110px;text-align:right">Rate</th>
        <th style="width:110px;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row subtotal">
      <span>Subtotal</span><span>${fmtINR(subtotal)}</span>
    </div>
    <div class="totals-row tax">
      <span>GST (${b.gstRate}%)</span><span>${fmtINR(gstAmt)}</span>
    </div>
    <div class="totals-row total">
      <span>Total</span><span>${fmtINR(total)}</span>
    </div>
  </div>

  <div class="inv-footer">
    <div class="inv-notes">
      ${
        b.notes
          ? `<div class="inv-notes-label">Notes</div>
             <div class="inv-notes-text">${b.notes}</div>`
          : ""
      }
    </div>
    <div class="inv-sign">
      <div class="inv-sign-line"></div>
      <div class="inv-sign-label">Authorised Signatory</div>
    </div>
  </div>

  <div class="inv-copy">
    This is a computer-generated invoice. No signature required. &nbsp;·&nbsp; Generated via SIRIUS
  </div>
</body>
</html>`;
}

// ── Sub-components ────────────────────────────────────────────────────────

function ReportService({ businesses }) {
  const [mode, setMode] = useState("business");
  const [selectedBizId, setSelectedBizId] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [csvName, setCsvName] = useState("");
  const [csvBizName, setCsvBizName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState(null);
  const [reportBiz, setReportBiz] = useState(null);
  const fileRef = useRef();

  async function handleGenerate() {
    setGenerating(true);
    setStats(null);

    try {
      if (mode === "business") {
        if (!selectedBizId) return;
        const { transactions } = await getTransactions(selectedBizId);
        const biz = businesses.find((b) => b.id === selectedBizId);
        setStats(computeStats(transactions || []));
        setReportBiz(biz);
      } else {
        if (!csvFile) return;
        Papa.parse(csvFile, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const txns = res.data.map((row) => ({
              amount: row.amount || row.Amount || 0,
              type: (row.type || row.Type || "expense").toLowerCase(),
              category: row.category || row.Category || null,
              timestamp: row.timestamp || row.Timestamp || row.date || row.Date || null,
            }));
            setStats(computeStats(txns));
            setReportBiz({ name: csvBizName || csvName.replace(/\.csv$/i, ""), type: null });
          },
        });
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!stats || !reportBiz) return;
    const html = buildReportHTML(
      reportBiz.name,
      reportBiz.type,
      stats,
      new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    );
    printHTML(html);
  }

  const canGenerate =
    mode === "business" ? !!selectedBizId : !!csvFile;

  return (
    <div className="svc-content">
      <div className="svc-desc">
        Generate a detailed 1-page financial report for any business. Download it as a PDF instantly.
      </div>

      <div className="svc-card">
        {/* Mode toggle */}
        <div className="svc-toggle-row">
          <button
            className={`svc-toggle-btn${mode === "business" ? " svc-toggle-btn--active" : ""}`}
            onClick={() => { setMode("business"); setStats(null); }}
          >
            Use Existing Business
          </button>
          <button
            className={`svc-toggle-btn${mode === "csv" ? " svc-toggle-btn--active" : ""}`}
            onClick={() => { setMode("csv"); setStats(null); }}
          >
            Upload CSV
          </button>
        </div>

        {mode === "business" ? (
          <div className="svc-field-group">
            <label className="svc-label">Select Business</label>
            {businesses.length === 0 ? (
              <p className="svc-hint">No businesses found. Create one in Track Expense first.</p>
            ) : (
              <select
                className="svc-select"
                value={selectedBizId}
                onChange={(e) => { setSelectedBizId(e.target.value); setStats(null); }}
              >
                <option value="">— Choose a business —</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.type ? ` (${b.type})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="svc-field-group">
            <label className="svc-label">CSV File</label>
            <p className="svc-hint">Format: <code>amount, type, category, timestamp</code> (same as Track Expense import)</p>
            <div
              className={`svc-file-drop${csvFile ? " svc-file-drop--has-file" : ""}`}
              onClick={() => fileRef.current?.click()}
            >
              {csvFile ? (
                <>
                  <span className="svc-file-icon">✓</span>
                  <span className="svc-file-name">{csvName}</span>
                  <button
                    className="svc-file-clear"
                    onClick={(e) => { e.stopPropagation(); setCsvFile(null); setCsvName(""); setStats(null); }}
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  <span className="svc-file-icon">↑</span>
                  <span>Click to upload CSV</span>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) { setCsvFile(f); setCsvName(f.name); setStats(null); }
              }}
            />
            <label className="svc-label" style={{ marginTop: "12px" }}>Business Name (optional)</label>
            <input
              className="svc-input"
              placeholder="e.g. My Shop"
              value={csvBizName}
              onChange={(e) => setCsvBizName(e.target.value)}
            />
          </div>
        )}

        <button
          className="svc-primary-btn"
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
        >
          {generating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {stats && reportBiz && (
        <div className="svc-report-preview">
          <div className="svc-report-header">
            <div>
              <h3 className="svc-report-biz">{reportBiz.name}</h3>
              {reportBiz.type && <span className="svc-report-type">{reportBiz.type}</span>}
            </div>
            <button className="svc-download-btn" onClick={handleDownload}>
              Download PDF
            </button>
          </div>

          <div className="svc-kpi-grid">
            <div className="svc-kpi svc-kpi--income">
              <span className="svc-kpi-label">Total Income</span>
              <span className="svc-kpi-value">{fmtINR(stats.income)}</span>
            </div>
            <div className="svc-kpi svc-kpi--expense">
              <span className="svc-kpi-label">Total Expenses</span>
              <span className="svc-kpi-value">{fmtINR(stats.expense)}</span>
            </div>
            <div className={`svc-kpi svc-kpi--net${stats.net >= 0 ? "--profit" : "--loss"}`}>
              <span className="svc-kpi-label">{stats.net >= 0 ? "Net Profit" : "Net Loss"}</span>
              <span className="svc-kpi-value">{fmtINR(Math.abs(stats.net))}</span>
            </div>
            <div className="svc-kpi svc-kpi--count">
              <span className="svc-kpi-label">Transactions</span>
              <span className="svc-kpi-value">{stats.count}</span>
            </div>
          </div>

          {stats.topCategories.length > 0 && (
            <div className="svc-section">
              <h4 className="svc-section-title">Top Categories</h4>
              <div className="svc-cat-list">
                {stats.topCategories.map((c) => {
                  const pct = stats.income + stats.expense > 0
                    ? Math.round((c.total / (stats.income + stats.expense)) * 100)
                    : 0;
                  return (
                    <div key={c.name} className="svc-cat-row">
                      <span className="svc-cat-name">{c.name}</span>
                      <div className="svc-cat-bar-wrap">
                        <div className="svc-cat-bar" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="svc-cat-pct">{pct}%</span>
                      <span className="svc-cat-total">{fmtINR(c.total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.months.length > 0 && (
            <div className="svc-section">
              <h4 className="svc-section-title">Monthly Trend</h4>
              <div className="svc-month-table">
                <div className="svc-month-head">
                  <span>Month</span><span>Income</span><span>Expenses</span><span>Net</span>
                </div>
                {stats.months.map((m) => (
                  <div key={m.label} className="svc-month-row">
                    <span>{m.label}</span>
                    <span className="text-income">{fmtINR(m.income)}</span>
                    <span className="text-expense">{fmtINR(m.expense)}</span>
                    <span className={m.income - m.expense >= 0 ? "text-income" : "text-expense"}>
                      {fmtINR(m.income - m.expense)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="svc-report-note">
            Click "Download PDF" to open a print-ready version. Use your browser's "Save as PDF" option.
          </p>
        </div>
      )}
    </div>
  );
}

function BillService() {
  const [bill, setBill] = useState({
    billNo: `INV-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().slice(0, 10),
    seller: { name: "", address: "", phone: "", gstin: "" },
    buyer: { name: "", address: "", phone: "" },
    items: [{ description: "", qty: 1, rate: "" }],
    gstRate: 18,
    notes: "",
  });

  function setSeller(field, value) {
    setBill((b) => ({ ...b, seller: { ...b.seller, [field]: value } }));
  }
  function setBuyer(field, value) {
    setBill((b) => ({ ...b, buyer: { ...b.buyer, [field]: value } }));
  }
  function setItem(i, field, value) {
    setBill((b) => {
      const items = [...b.items];
      items[i] = { ...items[i], [field]: value };
      return { ...b, items };
    });
  }
  function addItem() {
    setBill((b) => ({ ...b, items: [...b.items, { description: "", qty: 1, rate: "" }] }));
  }
  function removeItem(i) {
    setBill((b) => ({ ...b, items: b.items.filter((_, idx) => idx !== i) }));
  }

  const subtotal = bill.items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0);
  const gstAmt = (subtotal * bill.gstRate) / 100;
  const total = subtotal + gstAmt;

  function handlePrint() {
    printHTML(buildBillHTML(bill));
  }

  return (
    <div className="svc-content">
      <div className="svc-desc">
        Create professional GST invoices for your customers. Fill in the details and download instantly.
      </div>

      <div className="bill-layout">
        {/* Left: Form */}
        <div className="bill-form">
          <div className="svc-card">
            <h4 className="svc-card-subtitle">Invoice Details</h4>
            <div className="bill-row">
              <div className="svc-field-group">
                <label className="svc-label">Invoice No.</label>
                <input className="svc-input" value={bill.billNo} onChange={(e) => setBill((b) => ({ ...b, billNo: e.target.value }))} />
              </div>
              <div className="svc-field-group">
                <label className="svc-label">Date</label>
                <input className="svc-input" type="date" value={bill.date} onChange={(e) => setBill((b) => ({ ...b, date: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="svc-card">
            <h4 className="svc-card-subtitle">From (Seller)</h4>
            <div className="svc-field-group">
              <label className="svc-label">Business Name</label>
              <input className="svc-input" placeholder="Your Business Name" value={bill.seller.name} onChange={(e) => setSeller("name", e.target.value)} />
            </div>
            <div className="svc-field-group">
              <label className="svc-label">Address</label>
              <input className="svc-input" placeholder="Street, City, State — PIN" value={bill.seller.address} onChange={(e) => setSeller("address", e.target.value)} />
            </div>
            <div className="bill-row">
              <div className="svc-field-group">
                <label className="svc-label">Phone</label>
                <input className="svc-input" placeholder="+91 XXXXX XXXXX" value={bill.seller.phone} onChange={(e) => setSeller("phone", e.target.value)} />
              </div>
              <div className="svc-field-group">
                <label className="svc-label">GSTIN</label>
                <input className="svc-input" placeholder="22AAAAA0000A1Z5" value={bill.seller.gstin} onChange={(e) => setSeller("gstin", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="svc-card">
            <h4 className="svc-card-subtitle">Bill To (Customer)</h4>
            <div className="svc-field-group">
              <label className="svc-label">Customer Name</label>
              <input className="svc-input" placeholder="Customer Name / Company" value={bill.buyer.name} onChange={(e) => setBuyer("name", e.target.value)} />
            </div>
            <div className="svc-field-group">
              <label className="svc-label">Address</label>
              <input className="svc-input" placeholder="Customer address" value={bill.buyer.address} onChange={(e) => setBuyer("address", e.target.value)} />
            </div>
            <div className="svc-field-group">
              <label className="svc-label">Phone</label>
              <input className="svc-input" placeholder="+91 XXXXX XXXXX" value={bill.buyer.phone} onChange={(e) => setBuyer("phone", e.target.value)} />
            </div>
          </div>

          <div className="svc-card">
            <h4 className="svc-card-subtitle">Items</h4>
            {bill.items.map((it, i) => (
              <div key={i} className="bill-item-row">
                <input
                  className="svc-input bill-item-desc"
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) => setItem(i, "description", e.target.value)}
                />
                <input
                  className="svc-input bill-item-qty"
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={it.qty}
                  onChange={(e) => setItem(i, "qty", e.target.value)}
                />
                <input
                  className="svc-input bill-item-rate"
                  type="number"
                  min="0"
                  placeholder="Rate (₹)"
                  value={it.rate}
                  onChange={(e) => setItem(i, "rate", e.target.value)}
                />
                <span className="bill-item-amt">{fmtINR(Number(it.qty || 0) * Number(it.rate || 0))}</span>
                {bill.items.length > 1 && (
                  <button className="bill-item-remove" onClick={() => removeItem(i)}>×</button>
                )}
              </div>
            ))}
            <button className="bill-add-item" onClick={addItem}>+ Add Item</button>

            <div className="bill-gst-row">
              <label className="svc-label">GST Rate (%)</label>
              <select
                className="svc-select bill-gst-select"
                value={bill.gstRate}
                onChange={(e) => setBill((b) => ({ ...b, gstRate: Number(e.target.value) }))}
              >
                <option value={0}>0% (Exempt)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>

            <div className="svc-field-group">
              <label className="svc-label">Notes / Terms</label>
              <textarea
                className="svc-input svc-textarea"
                placeholder="Payment terms, bank details, thank you note..."
                value={bill.notes}
                onChange={(e) => setBill((b) => ({ ...b, notes: e.target.value }))}
              />
            </div>
          </div>

          <button className="svc-primary-btn" onClick={handlePrint}>
            Print / Download Invoice
          </button>
        </div>

        {/* Right: Live preview */}
        <div className="bill-preview">
          <div className="bill-preview-header">
            <span>Live Preview</span>
          </div>
          <div className="bill-preview-body">
            <div className="bill-pv-top">
              <div>
                <div className="bill-pv-brand">◈ SIRIUS</div>
                <div className="bill-pv-seller">{bill.seller.name || "Your Business"}</div>
                {bill.seller.address && <div className="bill-pv-meta">{bill.seller.address}</div>}
                {bill.seller.gstin && <div className="bill-pv-meta">GSTIN: {bill.seller.gstin}</div>}
              </div>
              <div className="bill-pv-invoice-block">
                <div className="bill-pv-title">INVOICE</div>
                <div className="bill-pv-meta">#{bill.billNo}</div>
                <div className="bill-pv-meta">{fmtDate(bill.date)}</div>
              </div>
            </div>

            {bill.buyer.name && (
              <div className="bill-pv-to">
                <div className="bill-pv-to-label">Bill To</div>
                <div className="bill-pv-to-name">{bill.buyer.name}</div>
                {bill.buyer.address && <div className="bill-pv-meta">{bill.buyer.address}</div>}
              </div>
            )}

            <table className="bill-pv-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.filter((it) => it.description).map((it, i) => (
                  <tr key={i}>
                    <td>{it.description}</td>
                    <td>{it.qty}</td>
                    <td>{fmtINR(it.rate)}</td>
                    <td>{fmtINR(Number(it.qty) * Number(it.rate || 0))}</td>
                  </tr>
                ))}
                {bill.items.every((it) => !it.description) && (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                      Add items above
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="bill-pv-totals">
              <div className="bill-pv-total-row">
                <span>Subtotal</span><span>{fmtINR(subtotal)}</span>
              </div>
              <div className="bill-pv-total-row">
                <span>GST ({bill.gstRate}%)</span><span>{fmtINR(gstAmt)}</span>
              </div>
              <div className="bill-pv-total-row bill-pv-grand">
                <span>Total</span><span>{fmtINR(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryService() {
  const [clicked, setClicked] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadDone, setDownloadDone] = useState(false);

  function handleDownload() {
    if (downloading || downloadDone) return;
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadDone(false);

    // Fake progress steps
    const steps = [8, 23, 41, 57, 72, 85, 93, 100];
    let i = 0;
    const tick = () => {
      if (i < steps.length) {
        setDownloadProgress(steps[i]);
        i++;
        setTimeout(tick, 280 + Math.random() * 200);
      } else {
        setDownloading(false);
        setDownloadDone(true);
      }
    };
    setTimeout(tick, 150);
  }

  return (
    <div className="svc-content">
      <div className="svc-desc">
        Streamline your last-mile delivery operations. Track orders, assign drivers, and get real-time updates.
      </div>

      <div className="svc-card delivery-card">
        <div className="delivery-icon">🚚</div>
        <h3 className="delivery-title">Delivery Management System</h3>
        <p className="delivery-sub">
          Full-featured delivery tracking with order management, driver assignment,
          route optimisation, and live status updates — built for MSME logistics.
        </p>
        <div className="delivery-features">
          {["Order Tracking", "Driver Assignment", "Route Optimisation", "Real-time Updates", "Analytics Dashboard", "Customer Notifications"].map((f) => (
            <span key={f} className="delivery-feature-tag">{f}</span>
          ))}
        </div>
        <div className="delivery-btn-row">
          <button
            className="svc-primary-btn delivery-demo-btn"
            onClick={() => setClicked(true)}
          >
            Launch Demo
          </button>
          <button
            className={`delivery-download-btn${downloadDone ? " delivery-download-btn--done" : ""}`}
            onClick={handleDownload}
            disabled={downloading || downloadDone}
          >
            {downloadDone ? "✓ Downloaded" : downloading ? "Downloading..." : "⬇ Download"}
          </button>
        </div>

        {downloading && (
          <div className="delivery-progress-wrap">
            <div className="delivery-progress-bar">
              <div
                className="delivery-progress-fill"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <span className="delivery-progress-pct">{downloadProgress}%</span>
          </div>
        )}

        {downloadDone && (
          <div className="delivery-dl-done">
            DeliveryManagementSystem_v2.4.1.exe downloaded successfully!
          </div>
        )}

        {clicked && !downloading && !downloadDone && (
          <div className="delivery-coming-soon">
            Coming soon — this feature is under active development!
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

const SERVICES = [
  { id: "report", label: "Business Report", icon: "📄" },
  { id: "bill", label: "Bill Generator", icon: "🧾" },
  { id: "delivery", label: "Delivery Management", icon: "🚚" },
];

function Services() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("report");

  useEffect(() => {
    async function init() {
      const { session: s } = await getSession();
      if (!s) { navigate("/"); return; }
      setSession(s);
      const { profile: p } = await getProfile(s.user.id);
      setProfile(p);
      const { businesses: biz } = await getBusinesses();
      setBusinesses(biz || []);
      setLoading(false);
    }
    init();
  }, [navigate]);

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  if (loading) {
    return (
      <div className="svc__loader-wrap">
        <div className="svc__loader" />
      </div>
    );
  }

  return (
    <div className="svc-page">
      <Navbar session={session} profile={profile} onLogin={signInWithGoogle} onLogout={handleLogout} />

      <div className="svc-hero">
        <div className="svc-hero__glow" />
        <span className="svc-hero__badge">MSME Tools</span>
        <h1 className="svc-hero__title">Business Services</h1>
        <p className="svc-hero__sub">
          Professional tools built for small businesses — generate reports, create invoices, and manage operations.
        </p>
      </div>

      <div className="svc-main">
        {/* Sidebar */}
        <aside className="svc-sidebar">
          {SERVICES.map((s) => (
            <button
              key={s.id}
              className={`svc-nav-btn${active === s.id ? " svc-nav-btn--active" : ""}`}
              onClick={() => setActive(s.id)}
            >
              <span className="svc-nav-icon">{s.icon}</span>
              <span className="svc-nav-label">{s.label}</span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="svc-body">
          <div className="svc-body-header">
            <h2 className="svc-body-title">
              {SERVICES.find((s) => s.id === active)?.icon}{" "}
              {SERVICES.find((s) => s.id === active)?.label}
            </h2>
          </div>

          {active === "report" && <ReportService businesses={businesses} />}
          {active === "bill" && <BillService />}
          {active === "delivery" && <DeliveryService />}
        </div>
      </div>
    </div>
  );
}

export default Services;
