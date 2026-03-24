import { useState, useEffect, useCallback } from "react";
import { getTransactions } from "../../../services/supabase/transactions";
import TransactionForm from "./TransactionForm";
import GraphPanel from "./GraphPanel";
import "./Dashboard.css";

function Dashboard({ businessId }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { transactions: data } = await getTransactions(businessId);
    setTransactions(data);
    setLoading(false);
  }, [businessId]);

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

  // Cash Runway calculation
  const runwayInfo = (() => {
    if (transactions.length === 0) return { label: "No Data", value: "—", modifier: "neutral" };
    const timestamps = transactions.map((t) => new Date(t.timestamp).getTime());
    const earliest = Math.min(...timestamps);
    const latest = Math.max(...timestamps);
    const days = Math.max(1, Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)));
    const balance = net;

    if (balance === 0) {
      return { label: "Break-even", value: "₹0.00", modifier: "neutral" };
    }
    if (balance < 0) {
      const dailyLoss = (totalExpense - totalIncome) / days;
      return { label: "Deficit State", value: `₹${dailyLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })} loss/day`, modifier: "deficit" };
    }
    const avgDailyExpense = totalExpense / days;
    if (avgDailyExpense === 0) {
      return { label: "Infinite Runway", value: "∞ days", modifier: "safe" };
    }
    const runwayDays = Math.floor(balance / avgDailyExpense);
    return { label: "Cash Runway", value: `${runwayDays} days`, modifier: runwayDays > 90 ? "safe" : runwayDays > 30 ? "warning" : "danger" };
  })();

  return (
    <div className="dashboard">
      {/* Summary cards */}
      <div className="dashboard__summary">
        <div className="dashboard__stat dashboard__stat--income">
          <span className="dashboard__stat-label">Total Income</span>
          <span className="dashboard__stat-value">₹{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="dashboard__stat dashboard__stat--expense">
          <span className="dashboard__stat-label">Total Expense</span>
          <span className="dashboard__stat-value">₹{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className={`dashboard__stat ${net >= 0 ? "dashboard__stat--profit" : "dashboard__stat--loss"}`}>
          <span className="dashboard__stat-label">Net Profit</span>
          <span className="dashboard__stat-value">₹{net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="dashboard__stat">
          <span className="dashboard__stat-label">Transactions</span>
          <span className="dashboard__stat-value">{transactions.length}</span>
        </div>
      </div>

      {/* Secondary stats row */}
      <div className="dashboard__summary dashboard__summary--secondary">
        <div className={`dashboard__stat dashboard__stat--runway-${runwayInfo.modifier}`}>
          <span className="dashboard__stat-label">Cash Runway</span>
          <span className="dashboard__stat-value">{runwayInfo.value}</span>
          <span className="dashboard__stat-sub">{runwayInfo.label}</span>
        </div>
      </div>

      {/* Transaction form */}
      <TransactionForm businessId={businessId} onAdded={fetchTransactions} />

      {/* Graphs */}
      {loading ? (
        <div className="dashboard__loading">Loading data...</div>
      ) : (
        <GraphPanel transactions={transactions} />
      )}
    </div>
  );
}

export default Dashboard;
