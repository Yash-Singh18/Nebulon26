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

  return (
    <div className="dashboard">
      {/* Summary cards */}
      <div className="dashboard__summary">
        <div className="dashboard__stat dashboard__stat--income">
          <span className="dashboard__stat-label">Total Income</span>
          <span className="dashboard__stat-value">${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="dashboard__stat dashboard__stat--expense">
          <span className="dashboard__stat-label">Total Expense</span>
          <span className="dashboard__stat-value">${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className={`dashboard__stat ${net >= 0 ? "dashboard__stat--profit" : "dashboard__stat--loss"}`}>
          <span className="dashboard__stat-label">Net Profit</span>
          <span className="dashboard__stat-value">${net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="dashboard__stat">
          <span className="dashboard__stat-label">Transactions</span>
          <span className="dashboard__stat-value">{transactions.length}</span>
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
