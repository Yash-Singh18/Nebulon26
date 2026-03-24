import { useState, useRef } from "react";
import Papa from "papaparse";
import { addTeamTransaction, addTeamTransactionsBatch } from "../../../services/supabase/teamTransactions";
import "./TeamTransactionForm.css";

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function TeamTransactionForm({ roomId, userId, isAdmin, onAdded }) {
  const [form, setForm] = useState({
    amount: "",
    type: "expense",
    category: "",
    timestamp: localNow(),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [csvStatus, setCsvStatus] = useState(null);
  const fileRef = useRef(null);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) return;

    setSaving(true);
    const status = isAdmin ? "approved" : "pending";
    const { error } = await addTeamTransaction({
      room_id: roomId,
      added_by: userId,
      amount: Number(form.amount),
      type: form.type,
      category: form.category.trim() || null,
      status,
      approved_by: isAdmin ? userId : null,
      timestamp: new Date(form.timestamp).toISOString(),
    });
    setSaving(false);

    if (!error) {
      setForm({ amount: "", type: "expense", category: "", timestamp: localNow() });
      setMessage(isAdmin ? "Transaction added!" : "Transaction submitted for approval");
      onAdded();
      setTimeout(() => setMessage(""), 3000);
    }
  }

  function handleCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvStatus("Parsing...");
    const status = isAdmin ? "approved" : "pending";

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
            room_id: roomId,
            added_by: userId,
            amount,
            type,
            category: row.category?.trim() || null,
            status,
            approved_by: isAdmin ? userId : null,
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
        const { error } = await addTeamTransactionsBatch(valid);

        if (error) {
          setCsvStatus("Upload failed. Please try again.");
        } else {
          setCsvStatus(
            isAdmin
              ? `${valid.length} transactions uploaded!`
              : `${valid.length} transactions submitted for approval!`
          );
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
    <div className="ttxform">
      <h3 className="ttxform__title">
        Add Transaction
        {!isAdmin && <span className="ttxform__pending-note">Requires admin approval</span>}
      </h3>

      <form className="ttxform__form" onSubmit={handleSubmit}>
        <div className="ttxform__row">
          <div className="ttxform__field">
            <label className="ttxform__label">Amount</label>
            <input
              className="ttxform__input"
              name="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={handleChange}
              required
            />
          </div>
          <div className="ttxform__field">
            <label className="ttxform__label">Type</label>
            <select
              className="ttxform__input ttxform__select"
              name="type"
              value={form.type}
              onChange={handleChange}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="ttxform__field">
            <label className="ttxform__label">Category</label>
            <input
              className="ttxform__input"
              name="category"
              placeholder="e.g. Food, Rent"
              value={form.category}
              onChange={handleChange}
            />
          </div>
          <div className="ttxform__field">
            <label className="ttxform__label">Date & Time</label>
            <input
              className="ttxform__input"
              name="timestamp"
              type="datetime-local"
              value={form.timestamp}
              onChange={handleChange}
            />
          </div>
          <button className="ttxform__submit" type="submit" disabled={saving}>
            {saving ? "..." : "+"}
          </button>
        </div>
      </form>

      <div className="ttxform__csv">
        <label className="ttxform__csv-label">
          <span className="ttxform__csv-icon">📁</span>
          Upload CSV
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleCSV}
            className="ttxform__csv-input"
          />
        </label>
        <span className="ttxform__csv-hint">
          Format: amount, type, category, timestamp
        </span>
        {csvStatus && <span className="ttxform__csv-status">{csvStatus}</span>}
      </div>

      {message && <p className="ttxform__message">{message}</p>}
    </div>
  );
}

export default TeamTransactionForm;
