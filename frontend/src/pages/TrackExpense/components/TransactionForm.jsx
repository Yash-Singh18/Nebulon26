import { useState, useRef } from "react";
import Papa from "papaparse";
import { addTransaction, addTransactionsBatch } from "../../../services/supabase/transactions";
import "./TransactionForm.css";

function TransactionForm({ businessId, onAdded }) {
  const [form, setForm] = useState({
    amount: "",
    type: "expense",
    category: "",
    timestamp: new Date().toISOString().slice(0, 16),
  });
  const [saving, setSaving] = useState(false);
  const [csvStatus, setCsvStatus] = useState(null);
  const fileRef = useRef(null);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) return;

    setSaving(true);
    const { error } = await addTransaction({
      business_id: businessId,
      amount: Number(form.amount),
      type: form.type,
      category: form.category.trim() || null,
      timestamp: new Date(form.timestamp).toISOString(),
    });
    setSaving(false);

    if (!error) {
      setForm({
        amount: "",
        type: "expense",
        category: "",
        timestamp: new Date().toISOString().slice(0, 16),
      });
      onAdded();
    }
  }

  function handleCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvStatus("Parsing...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const valid = [];

        for (const row of rows) {
          const amount = Number(row.amount);
          if (isNaN(amount)) continue;

          const type = (row.type || "").toLowerCase();
          if (type !== "income" && type !== "expense") continue;

          valid.push({
            business_id: businessId,
            amount,
            type,
            category: row.category?.trim() || null,
            timestamp: row.timestamp
              ? new Date(row.timestamp).toISOString()
              : new Date().toISOString(),
          });
        }

        if (valid.length === 0) {
          setCsvStatus("No valid rows found. Expected: amount, type, category, timestamp");
          return;
        }

        setCsvStatus(`Uploading ${valid.length} transactions...`);
        const { error } = await addTransactionsBatch(valid);

        if (error) {
          setCsvStatus("Upload failed. Please try again.");
        } else {
          setCsvStatus(`${valid.length} transactions uploaded!`);
          onAdded();
        }

        if (fileRef.current) fileRef.current.value = "";
        setTimeout(() => setCsvStatus(null), 3000);
      },
      error: () => {
        setCsvStatus("Failed to parse CSV.");
        if (fileRef.current) fileRef.current.value = "";
      },
    });
  }

  return (
    <div className="txform">
      <h3 className="txform__title">Add Transaction</h3>

      <form className="txform__form" onSubmit={handleSubmit}>
        <div className="txform__row">
          <div className="txform__field">
            <label className="txform__label">Amount</label>
            <input
              className="txform__input"
              name="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={handleChange}
              required
            />
          </div>

          <div className="txform__field">
            <label className="txform__label">Type</label>
            <select
              className="txform__input txform__select"
              name="type"
              value={form.type}
              onChange={handleChange}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>

          <div className="txform__field">
            <label className="txform__label">Category</label>
            <input
              className="txform__input"
              name="category"
              placeholder="e.g. Food, Rent"
              value={form.category}
              onChange={handleChange}
            />
          </div>

          <div className="txform__field">
            <label className="txform__label">Date & Time</label>
            <input
              className="txform__input"
              name="timestamp"
              type="datetime-local"
              value={form.timestamp}
              onChange={handleChange}
            />
          </div>

          <button className="txform__submit" type="submit" disabled={saving}>
            {saving ? "..." : "+"}
          </button>
        </div>
      </form>

      <div className="txform__csv">
        <label className="txform__csv-label">
          <span className="txform__csv-icon">📁</span>
          Upload CSV
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleCSV}
            className="txform__csv-input"
          />
        </label>
        <span className="txform__csv-hint">
          Format: amount, type, category, timestamp
        </span>
        {csvStatus && <span className="txform__csv-status">{csvStatus}</span>}
      </div>
    </div>
  );
}

export default TransactionForm;
