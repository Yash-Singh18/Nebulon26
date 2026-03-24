import { useState, useEffect, useCallback } from "react";
import { getTeamTransactions } from "../../../services/supabase/teamTransactions";
import TeamTransactionForm from "./TeamTransactionForm";
import TeamGraphPanel from "./TeamGraphPanel";
import "./TeamDashboard.css";

function TeamDashboard({ roomId, isAdmin, userId, members }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { transactions: data } = await getTeamTransactions(roomId, { status: "approved" });
    setTransactions(data);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const net = totalIncome - totalExpense;
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  const runwayInfo = (() => {
    if (transactions.length === 0) return { label: "No Data", value: "\u2014", modifier: "neutral" };
    const timestamps = transactions.map((t) => new Date(t.timestamp).getTime());
    const earliest = Math.min(...timestamps);
    const latest = Math.max(...timestamps);
    const days = Math.max(1, Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)));
    const balance = net;

    if (balance === 0) return { label: "Break-even", value: "\u20B90.00", modifier: "neutral" };
    if (balance < 0) {
      const dailyLoss = (totalExpense - totalIncome) / days;
      return { label: "Deficit State", value: `\u20B9${dailyLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })} loss/day`, modifier: "deficit" };
    }
    const avgDailyExpense = totalExpense / days;
    if (avgDailyExpense === 0) return { label: "Infinite Runway", value: "\u221E days", modifier: "safe" };
    const runwayDays = Math.floor(balance / avgDailyExpense);
    return { label: "Cash Runway", value: `${runwayDays} days`, modifier: runwayDays > 90 ? "safe" : runwayDays > 30 ? "warning" : "danger" };
  })();

  return (
    <div className="tdash">
      <div className="tdash__summary">
        <div className="tdash__stat tdash__stat--income">
          <span className="tdash__stat-label">Total Income</span>
          <span className="tdash__stat-value">{"\u20B9"}{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="tdash__stat tdash__stat--expense">
          <span className="tdash__stat-label">Total Expense</span>
          <span className="tdash__stat-value">{"\u20B9"}{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className={`tdash__stat ${net >= 0 ? "tdash__stat--profit" : "tdash__stat--loss"}`}>
          <span className="tdash__stat-label">Net Profit</span>
          <span className="tdash__stat-value">{"\u20B9"}{net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="tdash__stat">
          <span className="tdash__stat-label">Approved Txns</span>
          <span className="tdash__stat-value">{transactions.length}</span>
        </div>
      </div>

      <div className="tdash__summary tdash__summary--secondary">
        <div className={`tdash__stat tdash__stat--runway-${runwayInfo.modifier}`}>
          <span className="tdash__stat-label">Cash Runway</span>
          <span className="tdash__stat-value">{runwayInfo.value}</span>
          <span className="tdash__stat-sub">{runwayInfo.label}</span>
        </div>
      </div>

      <TeamTransactionForm roomId={roomId} userId={userId} isAdmin={isAdmin} onAdded={fetchTransactions} />

      {loading ? (
        <div className="tdash__loading">Loading data...</div>
      ) : (
        <TeamGraphPanel transactions={transactions} members={members} />
      )}
    </div>
  );
}

export default TeamDashboard;
