import { useState, useEffect, useRef, useCallback } from "react";
import { getMessages, sendChatMessage, subscribeToMessages, unsubscribeFromMessages } from "../../../services/supabase/teamChat";
import "./TeamChat.css";

function TeamChat({ roomId, userId, members, profile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const channelRef = useRef(null);

  // Load initial messages
  useEffect(() => {
    getMessages(roomId).then(({ messages: msgs }) => {
      setMessages(msgs);
    });
  }, [roomId]);

  // Subscribe to realtime
  useEffect(() => {
    const channel = subscribeToMessages(roomId, (newMsg) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });
    channelRef.current = channel;

    return () => {
      unsubscribeFromMessages(channelRef.current);
    };
  }, [roomId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract @mentions from text
  function extractMentions(text) {
    const regex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    const mentions = extractMentions(input);
    await sendChatMessage(roomId, input.trim(), mentions);
    setInput("");
    setSending(false);
    setShowMentions(false);
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setInput(val);

    // Check if user is typing @mention
    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setShowMentions(true);
      setMentionFilter("");
    } else if (lastAt !== -1) {
      const afterAt = val.slice(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(afterAt.toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }

  function insertMention(username) {
    const lastAt = input.lastIndexOf("@");
    const before = input.slice(0, lastAt);
    setInput(`${before}@${username} `);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  const filteredMembers = members.filter((m) => {
    const username = m.profiles?.username || "";
    const name = m.profiles?.name || "";
    return username.toLowerCase().includes(mentionFilter) || name.toLowerCase().includes(mentionFilter);
  });

  // Build a member lookup for department tags
  const memberMap = {};
  for (const m of members) {
    memberMap[m.user_id] = m;
  }

  function renderContent(content) {
    // Highlight @mentions
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="tchat__mention">{part}</span>
        );
      }
      return part;
    });
  }

  return (
    <div className="tchat">
      <div className="tchat__header">
        <div className="tchat__header-icon">💬</div>
        <div className="tchat__header-text">
          <h3 className="tchat__header-title">Team Chat</h3>
          <p className="tchat__header-sub">{members.length} members online</p>
        </div>
      </div>

      <div className="tchat__messages">
        {messages.length === 0 && (
          <div className="tchat__empty">
            No messages yet. Start the conversation!
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.user_id === userId;
          const memberInfo = memberMap[msg.user_id];
          const dept = memberInfo?.department;
          const isAdminUser = memberInfo?.role === "admin";

          return (
            <div key={msg.id} className={`tchat__msg${isMe ? " tchat__msg--me" : ""}`}>
              <div className="tchat__msg-avatar">
                {(memberInfo?.profiles?.name || memberInfo?.profiles?.username || "?").charAt(0).toUpperCase()}
              </div>
              <div className="tchat__msg-body">
                <div className="tchat__msg-header">
                  <span className="tchat__msg-name">
                    {memberInfo?.profiles?.username ? `@${memberInfo.profiles.username}` : (memberInfo?.profiles?.name || "Unknown")}
                  </span>
                  {isAdminUser && <span className="tchat__msg-admin">Admin</span>}
                  {dept && <span className="tchat__msg-dept">{dept}</span>}
                  <span className="tchat__msg-time">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="tchat__msg-content">
                  {renderContent(msg.content)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Mention suggestions */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="tchat__mentions">
          {filteredMembers.slice(0, 6).map((m) => (
            <button
              key={m.id}
              className="tchat__mention-item"
              onClick={() => insertMention(m.profiles?.username || m.profiles?.name)}
            >
              <span className="tchat__mention-name">
                @{m.profiles?.username || m.profiles?.name}
              </span>
              {m.department && <span className="tchat__mention-dept">{m.department}</span>}
            </button>
          ))}
        </div>
      )}

      <form className="tchat__input-bar" onSubmit={handleSend}>
        <input
          ref={inputRef}
          className="tchat__input"
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message... Use @ to mention"
          disabled={sending}
        />
        <button className="tchat__send" type="submit" disabled={sending || !input.trim()}>
          →
        </button>
      </form>
    </div>
  );
}

export default TeamChat;
