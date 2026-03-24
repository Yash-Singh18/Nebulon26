import { supabase } from "./client";

export async function getMessages(roomId, limit = 100) {
  try {
    const { data, error } = await supabase
      .from("team_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return { messages: data, error: null };
  } catch (error) {
    console.error("Get messages error:", error.message);
    return { messages: [], error };
  }
}

export async function sendChatMessage(roomId, content, mentions = []) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("team_messages")
      .insert([{ room_id: roomId, user_id: user.id, content, mentions }])
      .select()
      .single();
    if (error) throw error;
    return { message: data, error: null };
  } catch (error) {
    console.error("Send message error:", error.message);
    return { message: null, error };
  }
}

export function subscribeToMessages(roomId, callback) {
  const channel = supabase
    .channel(`room-messages-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "team_messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        // Use payload directly - profiles resolved via memberMap in component
        callback(payload.new);
      }
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromMessages(channel) {
  if (channel) {
    supabase.removeChannel(channel);
  }
}
