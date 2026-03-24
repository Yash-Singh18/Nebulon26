import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  getTransactions,
  updateTransaction,
  deleteTransaction,
} from "../../../services/supabase/transactions";
import "./ManageTransactions.css";

function ManageTransactions({ businessId }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [sortKey, setSortKey] = useState("timestamp");
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { transactions: data } = await getTransactions(businessId);
    setTransactions(data);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sorted = [...transactions]
    .filter((t) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return (
        t.category?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q) ||
        String(t.amount).includes(q) ||
        t.timestamp?.includes(q)
      );
    })
    .sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "amount") {
        av = Number(av);
        bv = Number(bv);
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  function startEdit(tx) {
    setEditingId(tx.id);
    setEditData({
      amount: tx.amount,
      type: tx.type,
      category: tx.category || "",
      timestamp: tx.timestamp ? tx.timestamp.slice(0, 16) : "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
  }

  async function saveEdit(id) {
    const updates = {
      amount: Number(editData.amount),
      type: editData.type,
      category: editData.category || null,
      timestamp: new Date(editData.timestamp).toISOString(),
    };
    const { error } = await updateTransaction(id, updates);
    if (!error) {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
      setEditingId(null);
      setEditData({});
    }
  }

  async function handleDelete(id) {
    const { error } = await deleteTransaction(id);
    if (!error) {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    }
  }

  const sortIcon = (key) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  if (loading) {
    return <div className="mtx__loading">Loading transactions...</div>;
  }

  return (
    <div className="mtx">
      <div className="mtx__header">
        <h2 className="mtx__title">Manage Transactions</h2>
        <span className="mtx__count">{transactions.length} total</span>
      </div>

      <input
        className="mtx__search"
        type="text"
        placeholder="Search by category, type, amount..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {sorted.length === 0 ? (
        <div className="mtx__empty">No transactions found.</div>
      ) : (
        <div className="mtx__table-wrap">
          <table className="mtx__table">
            <thead>
              <tr>
                <th onClick={() => handleSort("timestamp")}>
                  Date{sortIcon("timestamp")}
                </th>
                <th onClick={() => handleSort("type")}>
                  Type{sortIcon("type")}
                </th>
                <th onClick={() => handleSort("category")}>
                  Category{sortIcon("category")}
                </th>
                <th onClick={() => handleSort("amount")}>
                  Amount{sortIcon("amount")}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx) => (
                <tr key={tx.id} className={editingId === tx.id ? "mtx__row--editing" : ""}>
                  {editingId === tx.id ? (
                    <>
                      <td>
                        <input
                          className="mtx__edit-input"
                          type="datetime-local"
                          value={editData.timestamp}
                          onChange={(e) =>
                            setEditData((d) => ({ ...d, timestamp: e.target.value }))
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="mtx__edit-input"
                          value={editData.type}
                          onChange={(e) =>
                            setEditData((d) => ({ ...d, type: e.target.value }))
                          }
                        >
                          <option value="income">income</option>
                          <option value="expense">expense</option>
                        </select>
                      </td>
                      <td>
                        <input
                          className="mtx__edit-input"
                          type="text"
                          value={editData.category}
                          onChange={(e) =>
                            setEditData((d) => ({ ...d, category: e.target.value }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="mtx__edit-input"
                          type="number"
                          step="0.01"
                          value={editData.amount}
                          onChange={(e) =>
                            setEditData((d) => ({ ...d, amount: e.target.value }))
                          }
                        />
                      </td>
                      <td>
                        <div className="mtx__actions">
                          <button className="mtx__btn mtx__btn--save" onClick={() => saveEdit(tx.id)}>
                            Save
                          </button>
                          <button className="mtx__btn mtx__btn--cancel" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{format(parseISO(tx.timestamp), "MMM dd, yyyy HH:mm")}</td>
                      <td>
                        <span className={`mtx__type mtx__type--${tx.type}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td>{tx.category || "—"}</td>
                      <td className="mtx__amount">
                        ₹{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <div className="mtx__actions">
                          <button className="mtx__btn mtx__btn--edit" onClick={() => startEdit(tx)}>
                            Edit
                          </button>
                          <button className="mtx__btn mtx__btn--delete" onClick={() => handleDelete(tx.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ManageTransactions;
