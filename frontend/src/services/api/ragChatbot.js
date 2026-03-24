const RAG_SERVICE_URL =
  import.meta.env.VITE_RAG_SERVICE_URL || "http://localhost:8011";

export async function sendRagMessage(query, sessionId, language = "en") {
  try {
    const res = await fetch(`${RAG_SERVICE_URL}/api/rag/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        session_id: sessionId,
        language,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `RAG service error: ${res.status}`);
    }

    const data = await res.json();
    return { data, error: null };
  } catch (error) {
    console.error("RAG chat error:", error.message);
    return { data: null, error };
  }
}

export async function sendRagVoiceMessage(
  audioBlob,
  sessionId,
  language = "en",
  filename = "voice-message.webm"
) {
  try {
    const formData = new FormData();
    formData.append("audio", audioBlob, filename);
    formData.append("session_id", sessionId);
    formData.append("language", language);

    const res = await fetch(`${RAG_SERVICE_URL}/api/rag/voice`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `RAG voice error: ${res.status}`);
    }

    const data = await res.json();
    return { data, error: null };
  } catch (error) {
    console.error("RAG voice error:", error.message);
    return { data: null, error };
  }
}
