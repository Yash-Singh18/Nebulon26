import "./LeftNav.css";

const TABS = [
  { key: "about", label: "About", icon: "ℹ️" },
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "ai-bot", label: "AI Bot", icon: "🤖" },
];

function LeftNav({ activeTab, onTabChange, business, onBack }) {
  return (
    <aside className="leftnav">
      <div className="leftnav__header">
        <button className="leftnav__back" onClick={onBack}>
          ← Back
        </button>
        <div className="leftnav__business">
          <div className="leftnav__avatar">
            {business?.name?.charAt(0)?.toUpperCase() || "B"}
          </div>
          <div className="leftnav__info">
            <span className="leftnav__name">{business?.name || "Business"}</span>
            {business?.type && (
              <span className="leftnav__type">{business.type}</span>
            )}
          </div>
        </div>
      </div>

      <nav className="leftnav__menu">
        <span className="leftnav__section-label">Platform</span>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`leftnav__item${activeTab === tab.key ? " leftnav__item--active" : ""}`}
            onClick={() => onTabChange(tab.key)}
          >
            <span className="leftnav__item-icon">{tab.icon}</span>
            <span className="leftnav__item-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default LeftNav;
