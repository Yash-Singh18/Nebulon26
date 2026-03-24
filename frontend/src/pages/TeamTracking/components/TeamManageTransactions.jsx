import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { getTeamTransactions, deleteTeamTransaction } from "../../../services/supabase/teamTransactions";
import "./TeamManageTransactions.css";

function TeamManageTransactions({ roomId, isAdmin, userId, members }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("timestamp");
  const [sortAsc, setSortAsc] = useState(false);

  // Build member lookup for displaying names
  const memberMap = {};
  for (const m of members) {
    memberMap[m.user_id] = m.profiles || {};
  }

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const opts = statusFilter !== "all" ? { status: statusFilter } : {};
    const { transactions: data } = await getTeamTransactions(roomId, opts);
    setTransactions(data);
    setLoading(false);
  }, [roomId, statusFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function handleSort(key) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...transactions]
    .filter((t) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      const addedBy = memberMap[t.added_by]?.username || memberMap[t.added_by]?.name || "";
      return (
        t.category?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q) ||
        String(t.amount).includes(q) ||
        addedBy.toLowerCase().includes(q) ||
        t.timestamp?.includes(q)
      );
    })
    .sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "amount") { av = Number(av); bv = Number(bv); }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  async function handleDelete(id) {
    const { error } = await deleteTeamTransaction(id);
    if (!error) setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  const sortIcon = (key) => sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

  const statusClass = (s) => {
    if (s === "approved") return "tmtx__status--approved";
    if (s === "rejected") return "tmtx__status--rejected";
    return "tmtx__status--pending";
  };

  if (loading) return <div className="tmtx__loading">Loading transactions...</div>;

  return (
    <div className="tmtx">
      <div className="tmtx__header">
        <h2 className="tmtx__title">Manage Transactions</h2>
        <span className="tmtx__count">{transactions.length} total</span>
      </div>

      <div className="tmtx__filters">
        <input
          className="tmtx__search"
          type="text"
          placeholder="Search by category, type, user..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="tmtx__status-filters">
          {["all", "approved", "pending", "rejected"].map((s) => (
            <button
              key={s}
              className={`tmtx__filter-btn${statusFilter === s ? " tmtx__filter-btn--active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="tmtx__empty">No transactions found.</div>
      ) : (
        <div className="tmtx__table-wrap">
          <table className="tmtx__table">
            <thead>
              <tr>
                <th onClick={() => handleSort("timestamp")}>Date{sortIcon("timestamp")}</th>
                <th>Added By</th>
                <th onClick={() => handleSort("type")}>Type{sortIcon("type")}</th>
                <th onClick={() => handleSort("category")}>Category{sortIcon("category")}</th>
                <th onClick={() => handleSort("amount")}>Amount{sortIcon("amount")}</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx) => (
                <tr key={tx.id}>
                  <td>{format(parseISO(tx.timestamp), "MMM dd, yyyy HH:mm")}</td>
                  <td>
                    <span className="tmtx__user">
                      {memberMap[tx.added_by]?.username ? `@${memberMap[tx.added_by].username}` : memberMap[tx.added_by]?.name || "Unknown"}
                    </span>
                  </td>
                  <td>
                    <span className={`tmtx__type tmtx__type--${tx.type}`}>{tx.type}</span>
                  </td>
                  <td>{tx.category || "\u2014"}</td>
                  <td className="tmtx__amount">
                    {"\u20B9"}{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span className={`tmtx__status ${statusClass(tx.status)}`}>{tx.status}</span>
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="tmtx__btn tmtx__btn--delete" onClick={() => handleDelete(tx.id)}>
                        Delete
                      </button>
                    </td>
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

export default TeamManageTransactions;
