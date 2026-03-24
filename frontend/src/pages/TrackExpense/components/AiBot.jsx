import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../../../services/api/aibot";
import "./AiBot.css";

const PREBUILT = [
  { label: "Summarize my business", message: "Summarize my business performance" },
  { label: "Show biggest expenses", message: "What are my biggest expense categories?" },
  { label: "Show risks", message: "Are there any financial risks or anomalies I should be aware of?" },
  { label: "Give suggestions", message: "Give me actionable suggestions to improve my finances" },
  { label: "Predict future trend", message: "Based on my data, predict the future financial trend" },
];

function AiBot({ businessId, businessName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text) {
    if (!text.trim() || loading) return;

    const userMsg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const history = newMessages.map(({ role, content }) => ({ role, content }));
    const { response, tools_used, error } = await sendMessage(businessId, text.trim(), history);

    if (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that request. Please make sure the AI service is running." },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response, tools_used },
      ]);
    }
    setLoading(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="aibot">
      <div className="aibot__header">
        <div className="aibot__header-icon">🤖</div>
        <div>
          <h3 className="aibot__header-title">AI Financial Analyst</h3>
          <p className="aibot__header-sub">Analyzing {businessName || "your business"}</p>
        </div>
      </div>

      {/* Prebuilt actions */}
      {messages.length === 0 && (
        <div className="aibot__prebuilt">
          <p className="aibot__prebuilt-label">Quick actions</p>
          <div className="aibot__prebuilt-grid">
            {PREBUILT.map((p) => (
              <button
                key={p.label}
                className="aibot__prebuilt-btn"
                onClick={() => send(p.message)}
                disabled={loading}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="aibot__messages">
        {messages.map((msg, i) => (
          <div key={i} className={`aibot__msg aibot__msg--${msg.role}`}>
            <div className="aibot__msg-avatar">
              {msg.role === "user" ? "👤" : "🤖"}
            </div>
            <div className="aibot__msg-body">
              <div className="aibot__msg-content">{msg.content}</div>
              {msg.tools_used?.length > 0 && (
                <div className="aibot__msg-tools">
                  Tools used: {msg.tools_used.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="aibot__msg aibot__msg--assistant">
            <div className="aibot__msg-avatar">🤖</div>
            <div className="aibot__msg-body">
              <div className="aibot__typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="aibot__input-bar" onSubmit={handleSubmit}>
        <input
          className="aibot__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your business finances..."
          disabled={loading}
        />
        <button className="aibot__send" type="submit" disabled={loading || !input.trim()}>
          →
        </button>
      </form>

      {/* Prebuilt below chat */}
      {messages.length > 0 && (
        <div className="aibot__quick-row">
          {PREBUILT.slice(0, 3).map((p) => (
            <button
              key={p.label}
              className="aibot__quick-btn"
              onClick={() => send(p.message)}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AiBot;
