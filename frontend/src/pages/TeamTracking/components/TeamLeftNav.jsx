import "./TeamLeftNav.css";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "manage-tx", label: "Manage Transactions", icon: "📋" },
  { key: "admin-panel", label: "Admin Panel", icon: "🛡️", adminOnly: true },
  { key: "manage-team", label: "Manage Team", icon: "👥" },
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "ai-bot", label: "AI Bot", icon: "🤖" },
];

function TeamLeftNav({ activeTab, onTabChange, room, isAdmin, onBack }) {
  return (
    <aside className="tlnav">
      <div className="tlnav__header">
        <button className="tlnav__back" onClick={onBack}>
          ← Back
        </button>
        <div className="tlnav__room">
          <div className="tlnav__avatar">
            {room?.name?.charAt(0)?.toUpperCase() || "R"}
          </div>
          <div className="tlnav__info">
            <span className="tlnav__name">{room?.name || "Room"}</span>
            <span className="tlnav__code">{room?.room_code}</span>
          </div>
        </div>
      </div>

      <nav className="tlnav__menu">
        <span className="tlnav__section-label">Team</span>
        {TABS.map((tab) => {
          if (tab.adminOnly && !isAdmin) return null;
          return (
            <button
              key={tab.key}
              className={`tlnav__item${activeTab === tab.key ? " tlnav__item--active" : ""}`}
              onClick={() => onTabChange(tab.key)}
            >
              <span className="tlnav__item-icon">{tab.icon}</span>
              <span className="tlnav__item-label">{tab.label}</span>
            </button>
          );
        })}

        {!isAdmin && (
          <div className="tlnav__admin-hint">
            You can request admin access from Manage Team
          </div>
        )}
      </nav>
    </aside>
  );
}

export default TeamLeftNav;
