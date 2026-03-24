import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { sendTeamMessage } from "../../../services/api/teamAibot";
import "./TeamAiBot.css";

const PREBUILT = [
  { label: "Team summary", message: "Give me an overview of the team's financial performance" },
  { label: "Who spends most?", message: "Which team member has the highest expenses?" },
  { label: "Department breakdown", message: "Break down spending by department" },
  { label: "Spot anomalies", message: "Are there any unusual or anomalous transactions in the team?" },
  { label: "Top expenses", message: "What are the biggest team expenses?" },
  { label: "Team recommendations", message: "Give the team actionable suggestions to reduce costs" },
];

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const clean = text
    .replace(/\*\*/g, "")
    .replace(/[#*_`]/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.05;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function TeamAiBot({ roomId, roomName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    const { response, tools_used, error } = await sendTeamMessage(roomId, text.trim(), history);

    if (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that request. Make sure the AI service is running." },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response, tools_used },
      ]);
      if (voiceEnabled && response) speakText(response);
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
    <div className="taibot">
      <div className="taibot__header">
        <div className="taibot__header-icon">🤖</div>
        <div className="taibot__header-text">
          <h3 className="taibot__header-title">Team AI Analyst</h3>
          <p className="taibot__header-sub">Analyzing {roomName || "your team"}</p>
        </div>
        <button
          className={`taibot__voice-toggle${voiceEnabled ? " taibot__voice-toggle--on" : ""}`}
          onClick={() => {
            setVoiceEnabled((v) => !v);
            if (voiceEnabled) window.speechSynthesis?.cancel();
          }}
          title={voiceEnabled ? "Disable voice" : "Enable voice"}
        >
          {voiceEnabled ? "🔊" : "🔇"}
        </button>
      </div>

      {messages.length === 0 && (
        <div className="taibot__prebuilt">
          <p className="taibot__prebuilt-label">Quick actions</p>
          <div className="taibot__prebuilt-grid">
            {PREBUILT.map((p) => (
              <button
                key={p.label}
                className="taibot__prebuilt-btn"
                onClick={() => send(p.message)}
                disabled={loading}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="taibot__messages">
        {messages.map((msg, i) => (
          <div key={i} className={`taibot__msg taibot__msg--${msg.role}`}>
            <div className="taibot__msg-avatar">
              {msg.role === "user" ? "👤" : "🤖"}
            </div>
            <div className="taibot__msg-body">
              <div className="taibot__msg-content">
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              <div className="taibot__msg-meta">
                {msg.role === "assistant" && (
                  <button
                    className={`taibot__speak-btn${speakingIdx === i ? " taibot__speak-btn--active" : ""}`}
                    onClick={() => handleSpeak(msg.content, i)}
                    title={speakingIdx === i ? "Stop" : "Read aloud"}
                  >
                    {speakingIdx === i ? "⏹" : "🔈"}
                  </button>
                )}
                {msg.tools_used?.length > 0 && (
                  <span className="taibot__msg-tools">
                    {msg.tools_used.join(" → ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="taibot__msg taibot__msg--assistant">
            <div className="taibot__msg-avatar">🤖</div>
            <div className="taibot__msg-body">
              <div className="taibot__typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="taibot__input-bar" onSubmit={handleSubmit}>
        <input
          className="taibot__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your team's finances..."
          disabled={loading}
        />
        <button className="taibot__send" type="submit" disabled={loading || !input.trim()}>
          →
        </button>
      </form>

      {messages.length > 0 && (
        <div className="taibot__quick-row">
          {PREBUILT.slice(0, 4).map((p) => (
            <button
              key={p.label}
              className="taibot__quick-btn"
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

export default TeamAiBot;
