const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8010";

export async function sendMessage(businessId, message, history = []) {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_id: businessId,
        message,
        history,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `AI service error: ${res.status}`);
    }

    const data = await res.json();
    return { response: data.response, tools_used: data.tools_used || [], error: null };
  } catch (error) {
    console.error("AI chat error:", error.message);
    return { response: null, tools_used: [], error };
  }
}
