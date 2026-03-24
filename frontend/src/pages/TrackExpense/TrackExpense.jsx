import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, signInWithGoogle, signOut } from "../../services/supabase/auth";
import { getProfile } from "../../services/supabase/profiles";
import {
  getBusinesses,
  createBusiness,
  deleteBusiness,
} from "../../services/supabase/businesses";
import Navbar from "../../components/Navbar/Navbar";
import LeftNav from "./components/LeftNav";
import About from "./components/About";
import Dashboard from "./components/Dashboard";
import AiBot from "./components/AiBot";
import "./TrackExpense.css";

function TrackExpense() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // Create business modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function init() {
      const { session: s } = await getSession();
      if (!s) {
        navigate("/");
        return;
      }
      setSession(s);
      const { profile: p } = await getProfile(s.user.id);
      setProfile(p);
      const { businesses: biz } = await getBusinesses();
      setBusinesses(biz);
      setLoading(false);
    }
    init();
  }, [navigate]);

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const { business, error } = await createBusiness({
      name: newName.trim(),
      type: newType.trim() || null,
    });
    setCreating(false);
    if (!error && business) {
      setBusinesses((prev) => [business, ...prev]);
      setSelectedBiz(business);
      setActiveTab("about");
      setShowCreate(false);
      setNewName("");
      setNewType("");
    }
  }

  async function handleDelete(id) {
    const { error } = await deleteBusiness(id);
    if (!error) {
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      if (selectedBiz?.id === id) setSelectedBiz(null);
    }
  }

  function handleUpdateBiz(updated) {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
    setSelectedBiz(updated);
  }

  if (loading) {
    return (
      <div className="te__loader-wrap">
        <div className="te__loader" />
      </div>
    );
  }

  // Business selected → show layout with LeftNav
  if (selectedBiz) {
    return (
      <div className="te__layout">
        <Navbar session={session} profile={profile} onLogin={signInWithGoogle} onLogout={handleLogout} />
        <LeftNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          business={selectedBiz}
          onBack={() => setSelectedBiz(null)}
        />
        <main className="te__content">
          {activeTab === "about" && (
            <About business={selectedBiz} onUpdate={handleUpdateBiz} />
          )}
          {activeTab === "dashboard" && (
            <Dashboard businessId={selectedBiz.id} />
          )}
          {activeTab === "ai-bot" && (
            <AiBot businessId={selectedBiz.id} businessName={selectedBiz.name} />
          )}
        </main>
      </div>
    );
  }

  // No business selected → show business selector
  return (
    <div className="te">
      <Navbar session={session} profile={profile} onLogin={signInWithGoogle} onLogout={handleLogout} />
      <div className="te__header">
        <div>
          <h1 className="te__title">Track Expenses</h1>
          <p className="te__subtitle">Select a business or create a new one</p>
        </div>
        <button className="te__create-btn" onClick={() => setShowCreate(true)}>
          + New Business
        </button>
      </div>

      {businesses.length === 0 ? (
        <div className="te__empty">
          <div className="te__empty-icon">📊</div>
          <h3>No businesses yet</h3>
          <p>Create your first business to start tracking expenses</p>
          <button className="te__create-btn" onClick={() => setShowCreate(true)}>
            + Create Business
          </button>
        </div>
      ) : (
        <div className="te__grid">
          {businesses.map((biz) => (
            <div key={biz.id} className="te__biz-card" onClick={() => { setSelectedBiz(biz); setActiveTab("dashboard"); }}>
              <div className="te__biz-avatar">
                {biz.name.charAt(0).toUpperCase()}
              </div>
              <div className="te__biz-info">
                <h3 className="te__biz-name">{biz.name}</h3>
                {biz.type && <span className="te__biz-type">{biz.type}</span>}
                <span className="te__biz-date">
                  Created {new Date(biz.created_at).toLocaleDateString()}
                </span>
              </div>
              <button
                className="te__biz-delete"
                onClick={(e) => { e.stopPropagation(); handleDelete(biz.id); }}
                title="Delete business"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create business modal */}
      {showCreate && (
        <div className="te__modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="te__modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="te__modal-title">Create New Business</h2>
            <form onSubmit={handleCreate} className="te__modal-form">
              <div className="te__modal-field">
                <label className="te__modal-label">Business Name *</label>
                <input
                  className="te__modal-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Business"
                  required
                  autoFocus
                />
              </div>
              <div className="te__modal-field">
                <label className="te__modal-label">Business Type</label>
                <input
                  className="te__modal-input"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="e.g. Retail, SaaS, Consulting"
                />
              </div>
              <div className="te__modal-actions">
                <button type="button" className="te__modal-cancel" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="te__modal-submit" disabled={creating || !newName.trim()}>
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrackExpense;
