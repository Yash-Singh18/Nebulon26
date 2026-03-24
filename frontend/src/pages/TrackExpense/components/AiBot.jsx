import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { sendMessage } from "../../../services/api/aibot";
import "./AiBot.css";

const PREBUILT = [
  { label: "Summarize my business", message: "Summarize my business performance" },
  { label: "Show biggest expenses", message: "Where are my biggest expenses?" },
  { label: "Show risks", message: "Are there any financial risks or anomalies I should worry about?" },
  { label: "Give suggestions", message: "Give me actionable suggestions to improve my finances" },
  { label: "Predict future trend", message: "Based on my data, predict the future financial trend" },
  { label: "Recent activity", message: "Show me my recent transactions" },
];

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  // Strip markdown formatting for cleaner speech
  const clean = text
    .replace(/\*\*/g, "")
    .replace(/[#*_`→⚠️]/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.05;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function AiBot({ businessId, businessName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Stop speech on unmount
  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

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
      // Auto-speak if voice is enabled
      if (voiceEnabled && response) {
        speakText(response);
      }
    }
    setLoading(false);
  }

  function handleSpeak(text, idx) {
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
    } else {
      speakText(text);
      setSpeakingIdx(idx);
      // Reset when speech ends
      const checkDone = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          setSpeakingIdx(null);
          clearInterval(checkDone);
        }
      }, 200);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="aibot">
      <div className="aibot__header">
        <div className="aibot__header-icon">🤖</div>
        <div className="aibot__header-text">
          <h3 className="aibot__header-title">AI Financial Analyst</h3>
          <p className="aibot__header-sub">Analyzing {businessName || "your business"}</p>
        </div>
        <button
          className={`aibot__voice-toggle${voiceEnabled ? " aibot__voice-toggle--on" : ""}`}
          onClick={() => {
            setVoiceEnabled((v) => !v);
            if (voiceEnabled) window.speechSynthesis?.cancel();
          }}
          title={voiceEnabled ? "Disable voice" : "Enable voice"}
        >
          {voiceEnabled ? "🔊" : "🔇"}
        </button>
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
              <div className="aibot__msg-content">
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              <div className="aibot__msg-meta">
                {msg.role === "assistant" && (
                  <button
                    className={`aibot__speak-btn${speakingIdx === i ? " aibot__speak-btn--active" : ""}`}
                    onClick={() => handleSpeak(msg.content, i)}
                    title={speakingIdx === i ? "Stop" : "Read aloud"}
                  >
                    {speakingIdx === i ? "⏹" : "🔈"}
                  </button>
                )}
                {msg.tools_used?.length > 0 && (
                  <span className="aibot__msg-tools">
                    {msg.tools_used.join(" → ")}
                  </span>
                )}
              </div>
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
          {PREBUILT.slice(0, 4).map((p) => (
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
