import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { getPendingTransactions, approveTransaction, rejectTransaction } from "../../../services/supabase/teamTransactions";
import { getAdminRequests, handleAdminRequest } from "../../../services/supabase/teams";
import "./AdminPanel.css";

function AdminPanel({ roomId, userId, members, onMembersChange }) {
  const [pendingTxns, setPendingTxns] = useState([]);
  const [adminReqs, setAdminReqs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Build member lookup for displaying names
  const memberMap = {};
  for (const m of members) {
    memberMap[m.user_id] = m.profiles || {};
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [txRes, reqRes] = await Promise.all([
      getPendingTransactions(roomId),
      getAdminRequests(roomId),
    ]);
    setPendingTxns(txRes.transactions);
    setAdminReqs(reqRes.requests);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleApprove(id) {
    const { error } = await approveTransaction(id, userId);
    if (!error) setPendingTxns((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleReject(id) {
    const { error } = await rejectTransaction(id, userId);
    if (!error) setPendingTxns((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleAdminReq(reqId, status) {
    const { error } = await handleAdminRequest(reqId, status);
    if (!error) {
      setAdminReqs((prev) => prev.filter((r) => r.id !== reqId));
      if (status === "approved") onMembersChange();
    }
  }

  if (loading) return <div className="apanel__loading">Loading admin panel...</div>;

  return (
    <div className="apanel">
      <h2 className="apanel__title">Admin Panel</h2>

      {/* Pending Transactions */}
      <section className="apanel__section">
        <h3 className="apanel__section-title">
          Pending Transactions
          {pendingTxns.length > 0 && <span className="apanel__badge">{pendingTxns.length}</span>}
        </h3>

        {pendingTxns.length === 0 ? (
          <p className="apanel__empty">No pending transactions</p>
        ) : (
          <div className="apanel__cards">
            {pendingTxns.map((tx) => (
              <div key={tx.id} className="apanel__card">
                <div className="apanel__card-top">
                  <div className="apanel__card-info">
                    <span className={`apanel__card-type apanel__card-type--${tx.type}`}>{tx.type}</span>
                    <span className="apanel__card-amount">
                      {"\u20B9"}{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className="apanel__card-user">
                    by {memberMap[tx.added_by]?.username ? `@${memberMap[tx.added_by].username}` : memberMap[tx.added_by]?.name || "Unknown"}
                  </span>
                </div>
                <div className="apanel__card-details">
                  {tx.category && <span className="apanel__card-cat">{tx.category}</span>}
                  <span className="apanel__card-date">
                    {format(parseISO(tx.timestamp), "MMM dd, yyyy HH:mm")}
                  </span>
                </div>
                <div className="apanel__card-actions">
                  <button className="apanel__btn apanel__btn--approve" onClick={() => handleApprove(tx.id)}>
                    Approve
                  </button>
                  <button className="apanel__btn apanel__btn--reject" onClick={() => handleReject(tx.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Admin Requests */}
      <section className="apanel__section">
        <h3 className="apanel__section-title">
          Admin Access Requests
          {adminReqs.length > 0 && <span className="apanel__badge">{adminReqs.length}</span>}
        </h3>

        {adminReqs.length === 0 ? (
          <p className="apanel__empty">No pending admin requests</p>
        ) : (
          <div className="apanel__cards">
            {adminReqs.map((req) => (
              <div key={req.id} className="apanel__card apanel__card--request">
                <div className="apanel__card-top">
                  <span className="apanel__card-user">
                    {memberMap[req.user_id]?.username ? `@${memberMap[req.user_id].username}` : memberMap[req.user_id]?.name || "Unknown"}
                  </span>
                  <span className="apanel__card-date">
                    {format(parseISO(req.created_at), "MMM dd, yyyy")}
                  </span>
                </div>
                <p className="apanel__card-desc">Requesting admin access to this room</p>
                <div className="apanel__card-actions">
                  <button className="apanel__btn apanel__btn--approve" onClick={() => handleAdminReq(req.id, "approved")}>
                    Grant Admin
                  </button>
                  <button className="apanel__btn apanel__btn--reject" onClick={() => handleAdminReq(req.id, "rejected")}>
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminPanel;
