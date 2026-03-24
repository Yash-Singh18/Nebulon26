import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  sendRagMessage,
  sendRagVoiceMessage,
} from "../../services/api/ragChatbot";
import "./SmeExpertChat.css";

const QUICK_ACTIONS = [
  "How can I improve cash flow in a small business?",
  "Give me a simple weekly operating checklist for an SME owner.",
  "What are practical GST and tax planning basics I should follow?",
  "How should I approach hiring, training, and performance reviews?",
  "What low-cost marketing channels should a local business prioritize?",
  "How do I prepare my business before applying for funding?",
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
];

const GREETING =
  "Ask about finance, compliance, marketing, operations, HR, growth, or funding. Responses are grounded in the Sirius SME knowledge base, and voice transcription follows the language you select.";

const STORAGE_KEYS = {
  sessionId: "sirius-rag-session-id",
  messages: "sirius-rag-messages",
  language: "sirius-rag-language",
};

function readMessages() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.messages);
    if (!raw) {
      return [{ role: "assistant", content: GREETING }];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length
      ? parsed
      : [{ role: "assistant", content: GREETING }];
  } catch {
    return [{ role: "assistant", content: GREETING }];
  }
}

function getSessionId() {
  const existing = window.localStorage.getItem(STORAGE_KEYS.sessionId);
  if (existing) {
    return existing;
  }

  const sessionId =
    window.crypto?.randomUUID?.() ||
    `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(STORAGE_KEYS.sessionId, sessionId);
  return sessionId;
}

function ensureSessionId(sessionIdRef) {
  if (!sessionIdRef.current) {
    sessionIdRef.current = getSessionId();
  }

  return sessionIdRef.current;
}

function getRecorderMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((mimeType) =>
    window.MediaRecorder?.isTypeSupported?.(mimeType)
  );
}

function formatPercent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function normalizeAssistantMessage(data) {
  return {
    role: "assistant",
    content: data.response,
    confidence: data.confidence,
    confidenceLevel: data.confidence_level,
    source: data.source,
    category: data.category,
    resources: data.resources || [],
  };
}

function SmeExpertChat({ mode = "page" }) {
  const isWidget = mode === "widget";
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [messages, setMessages] = useState(() =>
    typeof window === "undefined"
      ? [{ role: "assistant", content: GREETING }]
      : readMessages()
  );
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") {
      return "en";
    }

    return window.localStorage.getItem(STORAGE_KEYS.language) || "en";
  });
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const bottomRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const sessionIdRef = useRef(null);
  const languageMenuRef = useRef(null);

  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEYS.messages,
      JSON.stringify(messages.slice(-30))
    );
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.language, language);
  }, [language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, loading, voiceBusy, isWidget]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop?.();
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!languageMenuRef.current?.contains(event.target)) {
        setLanguageMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function sendTextMessage(rawText) {
    const text = rawText.trim();
    if (!text || loading || voiceBusy) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    if (isWidget) {
      setIsOpen(true);
    }

    const { data, error } = await sendRagMessage(
      text,
      ensureSessionId(sessionIdRef),
      language
    );

    if (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "The SME expert is unavailable right now. Start `rag-service`, `qdrant`, and `redis`, then try again.",
        },
      ]);
      setLoading(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      normalizeAssistantMessage(data),
    ]);
    setLoading(false);
  }

  async function sendVoiceMessage(audioBlob) {
    setVoiceBusy(true);

    const extension = audioBlob.type.includes("mp4") ? "m4a" : "webm";
    const { data, error } = await sendRagVoiceMessage(
      audioBlob,
      ensureSessionId(sessionIdRef),
      language,
      `voice-message.${extension}`
    );

    if (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Voice upload failed. Check browser microphone permission and confirm the RAG stack is running.",
        },
      ]);
      setVoiceBusy(false);
      return;
    }

    if (data.transcript) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: data.transcript },
        normalizeAssistantMessage(data),
      ]);
    } else {
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    }

    setVoiceBusy(false);
  }

  async function startRecording() {
    if (loading || voiceBusy) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "This browser does not support in-browser audio recording. Use text chat instead.",
        },
      ]);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);

        if (blob.size > 0) {
          await sendVoiceMessage(blob);
        }
      };

      recorder.start();
      setRecording(true);
      setIsOpen(true);
    } catch (error) {
      console.error("Microphone access error:", error.message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Microphone access was blocked. Allow audio permission to use voice chat.",
        },
      ]);
    }
  }

  function stopRecording() {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendTextMessage(input);
  }

  function resetChat() {
    const nextMessages = [{ role: "assistant", content: GREETING }];
    setMessages(nextMessages);
    window.localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(nextMessages));
  }

  const activeLanguage =
    LANGUAGES.find((option) => option.code === language) || LANGUAGES[0];

  const conversation = (
    <>
      <div className="sme-chat__toolbar">
        <label className="sme-chat__language">
          <span>Language lock</span>
          <div
            ref={languageMenuRef}
            className={`sme-chat__language-shell${
              languageMenuOpen ? " sme-chat__language-shell--open" : ""
            }`}
          >
            <span className="sme-chat__language-icon" aria-hidden="true">
              A
            </span>
            <button
              type="button"
              className="sme-chat__language-trigger"
              onClick={() => setLanguageMenuOpen((prev) => !prev)}
              disabled={loading || voiceBusy || recording}
              aria-haspopup="listbox"
              aria-expanded={languageMenuOpen}
            >
              <span>{activeLanguage.label}</span>
            </button>
            <span className="sme-chat__language-caret" aria-hidden="true">
              v
            </span>

            {languageMenuOpen && (
              <div className="sme-chat__language-menu" role="listbox">
                {LANGUAGES.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    className={`sme-chat__language-option${
                      option.code === language
                        ? " sme-chat__language-option--active"
                        : ""
                    }`}
                    onClick={() => {
                      setLanguage(option.code);
                      setLanguageMenuOpen(false);
                    }}
                    role="option"
                    aria-selected={option.code === language}
                  >
                    <span>{option.label}</span>
                    {option.code === language && (
                      <span className="sme-chat__language-check">Selected</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <div className="sme-chat__actions">
          <button type="button" className="sme-chat__ghost" onClick={resetChat}>
            Reset
          </button>
        </div>
      </div>

      {!isWidget && (
        <div className="sme-chat__quick-actions">
          {QUICK_ACTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => sendTextMessage(question)}
              disabled={loading || voiceBusy}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      <div className="sme-chat__messages">
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={`sme-chat__message sme-chat__message--${message.role}`}
          >
            <div className="sme-chat__bubble">
              {message.role === "assistant" ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                <p>{message.content}</p>
              )}
            </div>

            {message.role === "assistant" && message.source && (
              <>
                <div className="sme-chat__meta">
                  <span>{message.source}</span>
                  <span>{message.category}</span>
                  <span>{message.confidenceLevel}</span>
                  <span>{formatPercent(message.confidence)}</span>
                </div>

                {message.resources?.length > 0 && (
                  <details className="sme-chat__resources">
                    <summary className="sme-chat__resources-toggle">
                      Show sources ({message.resources.length})
                    </summary>
                    <div className="sme-chat__resource-list">
                      {message.resources.map((resource) => (
                        <div
                          key={`${resource.source}-${resource.topic}`}
                          className="sme-chat__resource-card"
                        >
                          <div className="sme-chat__resource-head">
                            <strong>{resource.topic}</strong>
                            <span>{resource.source}</span>
                          </div>
                          <p>{resource.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </article>
        ))}

        {(loading || voiceBusy) && (
          <article className="sme-chat__message sme-chat__message--assistant">
            <div className="sme-chat__typing">
              <span />
              <span />
              <span />
            </div>
          </article>
        )}

        <div ref={bottomRef} />
      </div>

      <form className="sme-chat__composer" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask an SME question..."
          disabled={loading || voiceBusy}
        />
        <button
          type="button"
          className={`sme-chat__voice sme-chat__voice--composer${
            recording ? " sme-chat__voice--live" : ""
          }`}
          onClick={recording ? stopRecording : startRecording}
          disabled={loading || voiceBusy}
          aria-label={recording ? "Stop voice input" : "Start voice input"}
          title={recording ? "Stop voice input" : "Start voice input"}
        >
          {recording ? "Stop" : voiceBusy ? "..." : "Mic"}
        </button>
        <button type="submit" disabled={!input.trim() || loading || voiceBusy}>
          Send
        </button>
      </form>
    </>
  );

  if (isWidget) {
    return (
      <div className="sme-chat sme-chat--widget">
        <button
          type="button"
          className="sme-chat__launcher"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Close SME expert widget" : "Open SME expert widget"}
        >
          <span className="sme-chat__launcher-mark">AI</span>
          <span className="sme-chat__launcher-copy">
            <strong>SME Expert</strong>
            <span>Ask the knowledge base</span>
          </span>
        </button>

        {isOpen && (
          <aside className="sme-chat__panel">
            <header className="sme-chat__header">
              <div>
                <p className="sme-chat__eyebrow">Sirius RAG consultant</p>
                <h3 className="sme-chat__title">Small business expert</h3>
              </div>
              <div className="sme-chat__header-actions">
                <button
                  type="button"
                  className="sme-chat__ghost"
                  onClick={() => navigate("/sme-expert")}
                >
                  Expand
                </button>
                <button
                  type="button"
                  className="sme-chat__close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close widget"
                >
                  X
                </button>
              </div>
            </header>
            {conversation}
          </aside>
        )}
      </div>
    );
  }

  return (
    <section className="sme-chat sme-chat--page">
      <div className="sme-chat__page-shell">
        <div className="sme-chat__page-panel">
          <header className="sme-chat__header sme-chat__header--page">
            <div>
              <p className="sme-chat__eyebrow">Sirius RAG consultant</p>
              <h2 className="sme-chat__title">SME expert console</h2>
            </div>
            <div className="sme-chat__header-actions">
              <button
                type="button"
                className="sme-chat__ghost"
                onClick={resetChat}
              >
                New chat
              </button>
              <button
                type="button"
                className="sme-chat__ghost"
                onClick={() => navigate("/")}
              >
                Back home
              </button>
            </div>
          </header>
          {conversation}
        </div>
      </div>
    </section>
  );
}

export default SmeExpertChat;
