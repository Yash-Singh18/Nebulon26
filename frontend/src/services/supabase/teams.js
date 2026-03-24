import { supabase } from "./client";

// ── Room CRUD ──

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createRoom({ name, description }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const room_code = generateRoomCode();
    const { data, error } = await supabase
      .from("team_rooms")
      .insert([{ name, description: description || null, room_code, admin_id: user.id }])
      .select()
      .single();
    if (error) throw error;

    // Add creator as admin member
    const { error: memberErr } = await supabase
      .from("team_members")
      .insert([{ room_id: data.id, user_id: user.id, role: "admin", department: null }]);
    if (memberErr) console.error("Failed to add creator as member:", memberErr.message);

    return { room: data, error: null };
  } catch (error) {
    console.error("Create room error:", error.message);
    return { room: null, error };
  }
}

export async function getRooms() {
  try {
    const { data, error } = await supabase
      .from("team_rooms")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { rooms: data, error: null };
  } catch (error) {
    console.error("Get rooms error:", error.message);
    return { rooms: [], error };
  }
}

export async function joinRoom(roomCode, department) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Find room by code using RPC (bypasses RLS so non-members can look up)
    const { data: room, error: roomErr } = await supabase
      .rpc("lookup_room_by_code", { p_code: roomCode.trim() });
    if (roomErr || !room) throw new Error("Room not found. Check the code and try again.");

    // Join (insert policy allows any authenticated user with auth.uid() = user_id)
    const { error: joinErr } = await supabase
      .from("team_members")
      .insert([{ room_id: room.id, user_id: user.id, role: "member", department: department || null }]);
    if (joinErr) {
      if (joinErr.code === "23505") throw new Error("You are already a member of this room.");
      throw joinErr;
    }

    return { room, error: null };
  } catch (error) {
    console.error("Join room error:", error.message);
    return { room: null, error };
  }
}

export async function leaveRoom(roomId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user.id);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error("Leave room error:", error.message);
    return { error };
  }
}

export async function deleteRoom(roomId) {
  try {
    const { error } = await supabase
      .from("team_rooms")
      .delete()
      .eq("id", roomId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error("Delete room error:", error.message);
    return { error };
  }
}

// ── Members ──

export async function getMembers(roomId) {
  try {
    const { data, error } = await supabase
      .from("team_members")
      .select("*, profiles:user_id(id, name, username)")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    if (error) throw error;
    return { members: data, error: null };
  } catch (error) {
    console.error("Get members error:", error.message);
    return { members: [], error };
  }
}

export async function kickMember(roomId, userId) {
  try {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error("Kick member error:", error.message);
    return { error };
  }
}

export async function updateMemberDepartment(roomId, userId, department) {
  try {
    const { data, error } = await supabase
      .from("team_members")
      .update({ department })
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return { member: data, error: null };
  } catch (error) {
    console.error("Update department error:", error.message);
    return { member: null, error };
  }
}

// ── Admin Requests ──

export async function requestAdmin(roomId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("admin_requests")
      .insert([{ room_id: roomId, user_id: user.id }])
      .select()
      .single();
    if (error) throw error;
    return { request: data, error: null };
  } catch (error) {
    console.error("Request admin error:", error.message);
    return { request: null, error };
  }
}

export async function getAdminRequests(roomId) {
  try {
    const { data, error } = await supabase
      .from("admin_requests")
      .select("*, profiles:user_id(id, name, username)")
      .eq("room_id", roomId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { requests: data, error: null };
  } catch (error) {
    console.error("Get admin requests error:", error.message);
    return { requests: [], error };
  }
}

export async function handleAdminRequest(requestId, status) {
  try {
    const { data, error } = await supabase
      .from("admin_requests")
      .update({ status })
      .eq("id", requestId)
      .select()
      .single();
    if (error) throw error;
    return { request: data, error: null };
  } catch (error) {
    console.error("Handle admin request error:", error.message);
    return { request: null, error };
  }
}
